/**
 * Worker LLM 推理 handler
 * 基于 node-llama-cpp，在 Worker 线程内维护 llama/model 单例，
 * 并使用有界 LlamaContext 池隔离并发请求：每请求独占一个 context + 全新 chat session
 */
import fs from "node:fs";
import path from "node:path";
import type { Llama, LlamaModel, LlamaContext, LlamaContextSequence } from "node-llama-cpp";
import { Logger } from "@/main/utils/logger";

/** 将模型目录解析为具体的 .gguf 文件路径（modelManager.getModelPath 返回的是目录） */
function resolveModelFile(modelPath: string): string {
  if (fs.existsSync(modelPath)) {
    if (fs.statSync(modelPath).isFile()) return modelPath;
    const gguf = fs.readdirSync(modelPath).find((file) => file.toLowerCase().endsWith(".gguf"));
    if (gguf) return path.join(modelPath, gguf);
  }
  return modelPath;
}

/** load 因收到卸载请求而中止时抛出的错误消息（用于区分「真正的加载失败」与「按需取消」） */
const LOAD_CANCELLED = "本地 LLM 加载已取消：已收到卸载请求";

interface LlmLoadConfig {
  modelPath?: string;
  contextSize?: number;
  maxTokens?: number;
  temperature?: number;
  gpu?: "auto" | "cpu";
  /** 并发数（= context 池大小），每个并发占一份 KV cache 内存，默认 2 */
  concurrency?: number;
}

interface LlmGenerateOptions {
  maxTokens?: number;
  temperature?: number;
}

/** 池化条目：一个 context 及其绑定的 sequence */
interface PooledContext {
  context: LlamaContext;
  sequence: LlamaContextSequence;
}

type ChatSessionCtor = typeof import("node-llama-cpp").LlamaChatSession;

/** llama / model 保持单例（权重只加载一次，不重复加载） */
let llama: Llama | null = null;
let model: LlamaModel | null = null;
/** load 时缓存的 LlamaChatSession 构造器（CJS worker 必须动态 import node-llama-cpp） */
let chatSessionCtor: ChatSessionCtor | null = null;

/** context 池配置 */
let contextSize = 4096;
let concurrency = 2;

/** 全部已创建的 context（空闲 + 使用中），用于 unload 统一销毁 */
const allContexts = new Set<PooledContext>();
/** 空闲 context（可直接复用） */
const idleContexts: PooledContext[] = [];
/** 正在创建中的 context 数量，用于同步预留池容量，避免并发超额创建 */
let creatingCount = 0;
/** 池满时的 FIFO 等待队列 */
const waitQueue: Array<{ resolve: (pooled: PooledContext) => void; reject: (error: Error) => void }> = [];

/** 卸载中标记：置位后新的 acquireContext() 立即失败，避免与销毁竞态 */
let unloading = false;
/**
 * 是否已请求卸载：unload() 同步置位，load 在检查点发现它即中止并回收已建资源，
 * 避免「已在排队、马上要被拆掉却仍白加载模型权重」。由 doUnload() 在结束时复位。
 */
let unloadRequested = false;
/** 在途请求计数（已成功 acquire、尚未 release 的请求数） */
let inFlightCount = 0;
/** 排空等待的 resolver：在途计数归零时唤醒 unload() */
let drainResolve: (() => void) | null = null;

/**
 * 生命周期锁：load / unload 串行执行。
 * 不串行时二者会交叉，导致：卸载在 model 赋值前跑完 → 随后赋值生效（模型泄漏、与主进程状态不一致）；
 * 或 model 尚未销毁时 load 提前返回 → 上报 loaded 但实际已被销毁。
 * 锁链对失败也继续前进，单次失败不会卡死后续生命周期操作。
 */
let lifecycleChain: Promise<unknown> = Promise.resolve();

function withLifecycleLock<T>(task: () => Promise<T>): Promise<T> {
  const run = lifecycleChain.then(task, task);
  lifecycleChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function load(config?: LlmLoadConfig): Promise<{ modelName: string }> {
  // 与 unload 串行：避免「加载进行中又被卸载」导致模型泄漏或状态错乱
  return await withLifecycleLock(() => doLoad(config));
}

async function doLoad(config?: LlmLoadConfig): Promise<{ modelName: string }> {
  const modelPath = config?.modelPath;
  if (!modelPath) {
    throw new Error("本地 LLM 加载失败：缺少模型文件路径");
  }

  const modelFile = resolveModelFile(modelPath);

  contextSize = config?.contextSize ?? 4096;
  concurrency = Math.max(1, Math.floor(config?.concurrency ?? 2));

  // 已加载则直接返回（context 懒创建，首次 acquire 时才占用 KV cache 内存）
  if (model) {
    return { modelName: modelFile };
  }

  // 检查点 1：排队期间已收到卸载请求（load 在前、unload 在后），尚未创建任何资源，直接放弃
  if (unloadRequested) {
    throw new Error(LOAD_CANCELLED);
  }

  // node-llama-cpp 为 ESM 包，CJS worker 必须使用真正的动态 import()
  const { getLlama, LlamaChatSession: ChatSession } = await import("node-llama-cpp");

  let createdLlama: Llama;
  try {
    createdLlama = await getLlama({ gpu: config?.gpu === "cpu" ? false : "auto" });
  } catch (error) {
    // GPU 初始化失败时回退 CPU
    Logger.warn("[LLMHandler] GPU 初始化失败，回退 CPU", { error: String(error) });
    createdLlama = await getLlama({ gpu: false });
  }

  // 检查点 2：llama 初始化期间收到卸载请求 → 回收刚初始化的 llama
  if (unloadRequested) {
    await createdLlama.dispose();
    throw new Error(LOAD_CANCELLED);
  }

  const createdModel = await createdLlama.loadModel({ modelPath: modelFile });

  // 检查点 3：模型权重加载期间收到卸载请求 → 回收已创建的 model + llama
  if (unloadRequested) {
    try {
      await createdModel.dispose();
    } finally {
      await createdLlama.dispose();
    }
    throw new Error(LOAD_CANCELLED);
  }

  // 此后到赋值之间无 await，不会被取消标记穿插
  llama = createdLlama;
  model = createdModel;
  chatSessionCtor = ChatSession;

  Logger.info("[LLMHandler] 本地 LLM 已加载", { modelFile, contextSize, concurrency });
  return { modelName: modelFile };
}

/** 从池中获取一个独占 context；池满时 FIFO 排队等待（不抛错、不复用） */
async function acquireContext(): Promise<PooledContext> {
  // 卸载中：拒绝新请求，给出清晰错误（而非挂起或使用即将销毁的 context）
  if (unloading) throw new Error("本地 LLM 正在卸载");

  const activeModel = model;
  if (!activeModel || !chatSessionCtor) throw new Error("本地 LLM 未加载");

  const idle = idleContexts.pop();
  if (idle) {
    inFlightCount++;
    return idle;
  }

  if (allContexts.size + creatingCount < concurrency) {
    creatingCount++;
    try {
      const context = await activeModel.createContext({ contextSize });
      // unload 与创建竞态：若已卸载/正在卸载则销毁刚建的 context，避免泄漏
      if (model !== activeModel || unloading) {
        await context.dispose();
        throw new Error(unloading ? "本地 LLM 正在卸载" : "本地 LLM 已卸载");
      }
      const pooled: PooledContext = { context, sequence: context.getSequence() };
      allContexts.add(pooled);
      inFlightCount++;
      return pooled;
    } finally {
      creatingCount--;
    }
  }

  return await new Promise<PooledContext>((resolve, reject) => {
    waitQueue.push({
      // 成功拿到 context 后才计数，保证后续 release 能正确减计数
      resolve: (pooled) => {
        inFlightCount++;
        resolve(pooled);
      },
      reject,
    });
  });
}

/** 在途计数 -1；归零且正在排空时唤醒 unload() */
function decrementInFlight(): void {
  if (inFlightCount > 0) inFlightCount--;
  if (inFlightCount === 0 && drainResolve) {
    const resolve = drainResolve;
    drainResolve = null;
    resolve();
  }
}

/** 归还 context：优先交给等待者，否则放回空闲池 */
function releaseContext(pooled: PooledContext): void {
  // 卸载中：不再复用/归还 context（即将统一销毁），但必须减计数以唤醒排空中的 unload()
  if (unloading) {
    decrementInFlight();
    return;
  }
  if (!allContexts.has(pooled)) {
    // 卸载后归还的 context 已被销毁，直接释放
    void pooled.context.dispose();
    decrementInFlight();
    return;
  }
  const waiter = waitQueue.shift();
  if (waiter) {
    waiter.resolve(pooled);
  } else {
    idleContexts.push(pooled);
  }
  decrementInFlight();
}

export async function generate(prompt: string, options?: LlmGenerateOptions): Promise<string> {
  // 复用 generateStream，避免非流式/流式两条逻辑漂移
  return await generateStream(prompt, options);
}

export async function generateStream(
  prompt: string,
  options?: LlmGenerateOptions,
  onToken?: (text: string) => void,
): Promise<string> {
  if (!model || !chatSessionCtor) throw new Error("本地 LLM 未加载");

  const pooled = await acquireContext();
  try {
    // 每个请求使用全新 session，避免跨请求累积对话历史（历史污染）
    const session = new chatSessionCtor({ contextSequence: pooled.sequence });
    try {
      return await session.prompt(prompt, {
        maxTokens: options?.maxTokens ?? 1024,
        temperature: options?.temperature ?? 0.7,
        ...(onToken ? { onTextChunk: onToken } : {}),
      });
    } finally {
      session.dispose();
      // 清空 sequence 的 KV 历史，保证下一个请求拿到无残留的干净状态
      await pooled.sequence.clearHistory();
    }
  } finally {
    releaseContext(pooled);
  }
}

/**
 * 卸载：优雅排空（drain）后再销毁，绝不腰斩在途请求。
 * 幂等：未加载时调用、以及并发/重复调用均安全。
 */
export async function unload(): Promise<void> {
  // 同步置位：即使 load 正持锁执行，也能在它的下一个检查点被发现并中止，不必等锁释放
  unloadRequested = true;
  // 与 load 串行；doUnload 自身幂等，因此重复/并发卸载等价于一次
  return await withLifecycleLock(() => doUnload());
}

async function doUnload(): Promise<void> {
  // 1. 先置「卸载中」标记：此后新的 acquireContext() 立即抛清晰错误
  unloading = true;

  // 2. 立即 reject 尚未开始的等待者（它们未占用 context，必须失败而非无限等）
  const waiters = waitQueue.splice(0, waitQueue.length);
  for (const waiter of waiters) {
    waiter.reject(new Error("本地 LLM 正在卸载"));
  }

  // 3. 等待所有在途请求结束（其 finally 中 releaseContext 会减计数并唤醒这里）。
  //    只依赖在途请求的 finally，不反向等待，避免死锁。
  if (inFlightCount > 0) {
    await new Promise<void>((resolve) => {
      drainResolve = resolve;
    });
  }

  // 4. 在途归零后统一销毁：所有 context + sequence、model、llama，并清空池与标记
  const contexts = Array.from(allContexts);
  allContexts.clear();
  idleContexts.length = 0;

  for (const pooled of contexts) {
    try {
      await pooled.sequence.dispose();
    } catch (error) {
      Logger.warn("[LLMHandler] 释放 sequence 失败", { error: String(error) });
    }
    try {
      await pooled.context.dispose();
    } catch (error) {
      Logger.warn("[LLMHandler] 释放 context 失败", { error: String(error) });
    }
  }

  if (model) {
    try {
      await model.dispose();
    } catch (error) {
      Logger.warn("[LLMHandler] 释放 model 失败", { error: String(error) });
    }
    model = null;
  }
  if (llama) {
    try {
      await llama.dispose();
    } catch (error) {
      Logger.warn("[LLMHandler] 释放 llama 失败", { error: String(error) });
    }
    llama = null;
  }
  chatSessionCtor = null;

  inFlightCount = 0;
  drainResolve = null;
  unloading = false;
  // 复位取消标记：本次卸载已结束，此后排队的 load 应正常执行
  unloadRequested = false;
}