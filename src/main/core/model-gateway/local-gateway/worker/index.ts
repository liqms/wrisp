/**
 * Local AI Worker 线程入口
 * 每个模型 family 由独立 Worker 承载（创建时通过 workerData.family 指定），
 * 仅处理本 family 的消息，使三类模型可真正并行、且加载/卸载与崩溃相互隔离。
 */
import { parentPort, workerData } from "node:worker_threads";
import * as embeddingHandler from "./embedding-handler";
import * as rerankHandler from "./rerank-handler";
import * as llmHandler from "./llm-handler";
import type { TransformersModelPaths } from "../types";
import { Logger } from "@/main/utils/logger";

/** 本 Worker 承载的模型类别（与 model-registry 的 ModelFamily 一致，独立声明以免 worker 打包额外模块） */
type WorkerFamily = "embedding" | "reranker" | "llm";

interface WorkerMessage {
  id: string;
  type: string;
  payload?: unknown;
}

interface WorkerResponse {
  id: string;
  type: string;
  payload?: unknown;
  error?: string;
}

// 消息路由表（三类模型处理器的并集，实际可用项由 FAMILY_MESSAGE_TYPES 过滤）
const handlers: Record<string, (payload?: unknown) => Promise<unknown>> = {
  "load-embedding": (payload) => embeddingHandler.load(payload as { modelName?: string; transformers?: TransformersModelPaths; intraOpNumThreads?: number }),
  "embed": (payload) => {
    const { text, pooling, normalize } = payload as { text: string; pooling?: "mean" | "cls" | "none"; normalize?: boolean };
    return embeddingHandler.embed(text, pooling, normalize);
  },
  "embed-batch": (payload) => {
    const { texts, pooling, normalize } = payload as { texts: string[]; pooling?: "mean" | "cls" | "none"; normalize?: boolean };
    return embeddingHandler.embedBatch(texts, pooling, normalize);
  },
  "unload-embedding": () => embeddingHandler.unload(),

  "load-rerank": (payload) => rerankHandler.load(payload as { modelName?: string; transformers?: TransformersModelPaths; intraOpNumThreads?: number }),
  "rerank": (payload) => {
    const { query, documents } = payload as { query: string; documents: string[] };
    return rerankHandler.rerank(query, documents);
  },
  "unload-rerank": () => rerankHandler.unload(),

  "load-llm": (payload) => llmHandler.load(payload as {
    modelPath?: string;
    contextSize?: number;
    maxTokens?: number;
    temperature?: number;
    gpu?: "auto" | "cpu";
    gpuLayers?: 0 | "auto";
    concurrency?: number;
    maxThreads?: number;
  }),
  "probe-gpu": (payload) => llmHandler.probeGpu(payload as { maxThreads?: number } | undefined),
  "generate": (payload) => {
    const { prompt, options } = payload as {
      prompt: string;
      options?: { maxTokens?: number; temperature?: number };
    };
    return llmHandler.generate(prompt, options);
  },
  "unload-llm": () => llmHandler.unload(),
};

/** family → 本 Worker 允许处理的消息类型 */
const FAMILY_MESSAGE_TYPES: Record<WorkerFamily, readonly string[]> = {
  embedding: ["load-embedding", "embed", "embed-batch", "unload-embedding"],
  reranker: ["load-rerank", "rerank", "unload-rerank"],
  llm: ["load-llm", "generate", "generate-stream", "probe-gpu", "unload-llm"],
};

// 响应类型映射
const responseTypeMap: Record<string, string> = {
  "load-embedding": "embedding-loaded",
  "embed": "embedding-result",
  "embed-batch": "embedding-result",
  "unload-embedding": "embedding-unloaded",
  "load-rerank": "rerank-loaded",
  "rerank": "rerank-result",
  "unload-rerank": "rerank-unloaded",
  "load-llm": "llm-loaded",
  "generate": "llm-result",
  "generate-stream": "llm-result",
  "probe-gpu": "gpu-probe-result",
  "unload-llm": "llm-unloaded",
};

/** 本 Worker 承载的 family（由主进程注入） */
const family = (workerData as { family?: WorkerFamily } | undefined)?.family ?? null;
/** 本 Worker 允许处理的消息类型；未注入 family 时退化为全部（兼容直接加载本入口的场景） */
const allowedTypes = new Set<string>(family ? FAMILY_MESSAGE_TYPES[family] : Object.keys(handlers));

Logger.info("[Worker] 线程启动", { family: family ?? "all" });

/** Worker 消息入口 - 按 family 过滤后路由到对应的 handler */
parentPort?.on("message", async (event: WorkerMessage) => {
  const { id, type, payload } = event;

  try {
    if (!allowedTypes.has(type)) {
      throw new Error(`未知消息类型: ${type}`);
    }

    // 流式生成需按请求 id 逐 token 推送，特判处理（不走 handlers 映射）
    if (type === "generate-stream") {
      const { prompt, options } = (payload ?? {}) as {
        prompt: string;
        options?: { maxTokens?: number; temperature?: number };
      };
      const text = await llmHandler.generateStream(prompt, options, (token) => {
        parentPort?.postMessage({ id, type: "llm-token", payload: { token } } satisfies WorkerResponse);
      });
      // 最终文本按裸字符串回传：manager 侧是 dispatch<string>，
      // 包一层 { text } 会让声明的 string 实际收到对象（与非流式分支保持一致）
      parentPort?.postMessage({ id, type: "llm-result", payload: text } satisfies WorkerResponse);
      return;
    }

    const handler = handlers[type];
    if (!handler) {
      throw new Error(`未知消息类型: ${type}`);
    }

    const result = await handler(payload);
    const responseType = responseTypeMap[type] || type;

    parentPort?.postMessage({ id, type: responseType, payload: result } satisfies WorkerResponse);
  } catch (error) {
    Logger.error("[Worker] 处理消息失败", { family: family ?? "all", type, error: String(error) });
    parentPort?.postMessage({ id, type: "error", error: String(error) } satisfies WorkerResponse);
  }
});