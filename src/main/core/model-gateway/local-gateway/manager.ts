/**
 * 本地 AI 模型管理器
 * 单例模式，负责各 family 独立 Worker 线程的生命周期管理及消息调度
 */
import { Worker } from "worker_threads";
import { join } from "path";
import { ModelState, EmbeddingConfig, RerankConfig, LlmConfig, LlmGenerateOptions, LocalAiConfig, TransformersModelPaths, DEFAULT_EMBEDDING_CONFIG, DEFAULT_RERANK_CONFIG, DEFAULT_LLM_CONFIG } from "./types";
import { recommendLlmConcurrency } from "./hardware";
import { getModelSpec, getFamilyModelId, getTransformersArtifacts } from "./model-registry";
import type { ModelFamily } from "./model-registry";
import { modelManager } from "./model-manager";
import { Logger } from "@/main/utils/logger";

// 消息 ID 生成器
let messageIdCounter = 0;
const generateMessageId = () => `msg_${++messageIdCounter}_${Date.now()}`;

type PendingResolver = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

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

/**
 * 单个 family 的 Worker 通道：封装一个 Worker 线程及其在途请求 / 流式回调。
 * 三类模型各自独立线程，推理互不阻塞，加载/卸载与崩溃也相互隔离。
 */
class WorkerChannel {
  private worker: Worker | null = null;
  private pendingMessages = new Map<string, PendingResolver>();
  /** 流式请求回调：按请求 id 保存，llm-token 消息到达时逐段触发 */
  private streamCallbacks = new Map<string, (token: string) => void>();
  /** 已终止标记：防止 dispose 后 exit 事件触发无谓的自动重启，造成线程泄漏 */
  private disposed = false;

  constructor(private readonly family: ModelFamily) { }

  /**
   * 确保本 family 的 Worker 已启动
   */
  private ensureWorker(): Worker {
    if (!this.worker) {
      // Worker 由 vite 独立打包为 CJS（dist-electron/local-ai-worker.js），
      // 主进程为 CJS 构建，使用 __dirname 解析其绝对路径（import.meta.url 会编译为 undefined）；
      // 同一入口通过 workerData.family 区分承载的模型类别。
      this.worker = new Worker(join(__dirname, "local-ai-worker.js"), {
        workerData: { family: this.family },
      });
      this.worker.on("message", this.handleMessage.bind(this));
      this.worker.on("error", this.handleError.bind(this));
      this.worker.on("exit", this.handleExit.bind(this));
      Logger.info("[LocalAiManager] Worker 线程已启动", { family: this.family });
    }
    return this.worker;
  }

  /**
   * 向 Worker 发送消息并等待响应
   */
  public send<T>(type: string, payload?: unknown): Promise<T> {
    return this.dispatch<T>(generateMessageId(), type, payload);
  }

  /**
   * 以指定消息 ID 向 Worker 发送消息并等待响应（流式请求需预先注册回调）
   */
  public dispatch<T>(id: string, type: string, payload?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const worker = this.ensureWorker();
      this.pendingMessages.set(id, { resolve: resolve as (value: unknown) => void, reject });
      worker.postMessage({ id, type, payload } satisfies WorkerMessage);
    });
  }

  /** 注册流式 token 回调 */
  public setStreamCallback(id: string, callback: (token: string) => void): void {
    this.streamCallbacks.set(id, callback);
  }

  /** 移除流式 token 回调 */
  public clearStreamCallback(id: string): void {
    this.streamCallbacks.delete(id);
  }

  /**
   * 处理 Worker 返回的消息
   * 注意：Node worker_threads 的 `on("message")` 回调参数是消息本体，
   * 而非浏览器风格的 MessageEvent（不存在 `.data`），故直接解构。
   */
  private handleMessage(message: WorkerResponse): void {
    const { id, type, payload, error } = message;

    // 流式 token 推送：仅触发回调，不 resolve/reject 或删除 pending（最终由 llm-result settle）
    if (type === "llm-token") {
      const onToken = this.streamCallbacks.get(id);
      if (onToken) {
        onToken((payload as { token: string }).token);
      }
      return;
    }

    const pending = this.pendingMessages.get(id);
    if (!pending) return;
    this.pendingMessages.delete(id);

    if (error) {
      pending.reject(new Error(error));
      return;
    }

    pending.resolve(payload);
  }

  /**
   * 处理 Worker 错误
   */
  private handleError(error: Error): void {
    Logger.error("[LocalAiManager] Worker 线程错误", { family: this.family, error: error.message });
    for (const [id, pending] of this.pendingMessages) {
      pending.reject(error);
      this.pendingMessages.delete(id);
    }
    this.streamCallbacks.clear();
    // 自动重启本 family 的 Worker
    this.restartWorker();
  }

  /**
   * 处理 Worker 退出
   */
  private handleExit(code: number): void {
    Logger.warn("[LocalAiManager] Worker 线程退出", { family: this.family, code });
    this.worker = null;
    this.streamCallbacks.clear();
    if (code !== 0 && !this.disposed) {
      this.restartWorker();
    }
  }

  /**
   * 重启本 family 的 Worker
   */
  private restartWorker(): void {
    if (this.disposed) return;
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    // 延迟重启
    setTimeout(() => {
      if (this.disposed) return;
      try {
        this.ensureWorker();
        Logger.info("[LocalAiManager] Worker 线程已重启", { family: this.family });
      } catch (error) {
        Logger.error("[LocalAiManager] Worker 重启失败", { family: this.family, error: String(error) });
      }
    }, 1000);
  }

  /**
   * 终止本 family 的 Worker（幂等）
   */
  public async terminate(): Promise<void> {
    this.disposed = true;
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
    this.pendingMessages.clear();
    this.streamCallbacks.clear();
  }
}

class LocalAiManager {
  private static instance: LocalAiManager | null = null;

  /** 每个模型 family 一个独立 Worker 线程 */
  private channels: Record<ModelFamily, WorkerChannel> = {
    embedding: new WorkerChannel("embedding"),
    reranker: new WorkerChannel("reranker"),
    llm: new WorkerChannel("llm"),
  };

  private embeddingConfig: Required<EmbeddingConfig> = { ...DEFAULT_EMBEDDING_CONFIG };
  private rerankConfig: Required<RerankConfig> = { ...DEFAULT_RERANK_CONFIG };
  private llmConfig: Partial<LlmConfig> = { ...DEFAULT_LLM_CONFIG };

  private embeddingState: ModelState = {
    status: "unloaded",
    modelName: DEFAULT_EMBEDDING_CONFIG.modelName,
  };

  private rerankState: ModelState = {
    status: "unloaded",
    modelName: DEFAULT_RERANK_CONFIG.modelName,
  };

  private llmState: ModelState = {
    status: "unloaded",
    modelName: DEFAULT_LLM_CONFIG.modelId,
  };

  /** 本地 LLM 在途请求数（生成中）；供空闲卸载判定使用，避免腰斩在途生成 */
  private llmInFlight = 0;

  /** 私有构造函数，防止外部实例化 */
  private constructor() { }

  /** 获取 LocalAiManager 单例 */
  public static getInstance(): LocalAiManager {
    if (!LocalAiManager.instance) {
      LocalAiManager.instance = new LocalAiManager();
    }
    return LocalAiManager.instance;
  }

  /**
   * 初始化配置
   */
  public configure(config?: LocalAiConfig): void {
    if (config?.embedding) {
      this.embeddingConfig = { ...DEFAULT_EMBEDDING_CONFIG, ...config.embedding };
      this.embeddingState.modelName = this.embeddingConfig.modelName;
    }
    if (config?.rerank) {
      this.rerankConfig = { ...DEFAULT_RERANK_CONFIG, ...config.rerank };
      this.rerankState.modelName = this.rerankConfig.modelName;
    }
    if (config?.llm) {
      this.llmConfig = { ...DEFAULT_LLM_CONFIG, ...config.llm };
      this.llmState.modelName = this.llmConfig.modelId ?? DEFAULT_LLM_CONFIG.modelId;
    }
  }

  /**
   * 解析某 family 的本地模型文件定位信息，
   * 使 worker 的 transformers.js 直接从下载目录读取，而非回退到远程或模块内缓存。
   * 未注册或缺少 onnx 产物时返回 undefined（worker 退回默认远程/modelName 行为）。
   */
  private resolveTransformersPaths(family: "embedding" | "reranker"): TransformersModelPaths | undefined {
    const modelId = getFamilyModelId(family);
    if (!modelId) return undefined;
    const artifacts = getTransformersArtifacts(modelId);
    if (!artifacts) return undefined;
    return { modelRoot: modelManager.getModelsBasePath(), ...artifacts };
  }

  /**
   * 加载嵌入模型
   */
  public async loadEmbeddingModel(config?: Partial<EmbeddingConfig>): Promise<void> {
    if (this.embeddingState.status === "loaded") return;
    const mergedConfig = {
      ...this.embeddingConfig,
      ...config,
      transformers: this.resolveTransformersPaths("embedding"),
    };
    const result = await this.channels.embedding.send<{ modelName: string }>("load-embedding", mergedConfig);
    this.embeddingState = { status: "loaded", modelName: result.modelName };
  }

  /**
   * 加载重排序模型
   */
  public async loadRerankModel(config?: Partial<RerankConfig>): Promise<void> {
    if (this.rerankState.status === "loaded") return;
    const mergedConfig = {
      ...this.rerankConfig,
      ...config,
      transformers: this.resolveTransformersPaths("reranker"),
    };
    const result = await this.channels.reranker.send<{ modelName: string }>("load-rerank", mergedConfig);
    this.rerankState = { status: "loaded", modelName: result.modelName };
  }

  /**
   * 卸载嵌入模型
   */
  public async unloadEmbeddingModel(): Promise<void> {
    if (this.embeddingState.status === "unloaded") return;
    await this.channels.embedding.send("unload-embedding");
    this.embeddingState = { status: "unloaded", modelName: this.embeddingConfig.modelName };
  }

  /**
   * 卸载重排序模型
   */
  public async unloadRerankModel(): Promise<void> {
    if (this.rerankState.status === "unloaded") return;
    await this.channels.reranker.send("unload-rerank");
    this.rerankState = { status: "unloaded", modelName: this.rerankConfig.modelName };
  }

  /**
   * 获取嵌入模型状态
   */
  public getEmbeddingModelStatus(): ModelState {
    return { ...this.embeddingState };
  }

  /**
   * 获取重排序模型状态
   */
  public getRerankModelStatus(): ModelState {
    return { ...this.rerankState };
  }

  /**
   * 懒加载：确保嵌入模型已加载
   */
  public async ensureEmbeddingModel(config?: Partial<EmbeddingConfig>): Promise<void> {
    if (this.embeddingState.status !== "loaded") {
      await this.loadEmbeddingModel(config);
    }
  }

  /**
   * 懒加载：确保重排序模型已加载
   */
  public async ensureRerankModel(config?: Partial<RerankConfig>): Promise<void> {
    if (this.rerankState.status !== "loaded") {
      await this.loadRerankModel(config);
    }
  }

  /**
   * 加载本地 LLM
   */
  public async loadLlmModel(config?: Partial<LlmConfig>): Promise<void> {
    if (this.llmState.status === "loaded") return;
    this.llmConfig = { ...this.llmConfig, ...config };

    // 按当前可用内存自适应 context 池并发：只向下夹紧，配置值恒为上限。
    const modelId = this.llmConfig.modelId ?? DEFAULT_LLM_CONFIG.modelId;
    const spec = getModelSpec(modelId);
    const modelSizeGB = spec?.variants.find((v) => v.variantId === spec.defaultVariant)?.sizeGB;
    const maxConcurrency = this.llmConfig.concurrency ?? DEFAULT_LLM_CONFIG.concurrency;
    if (modelSizeGB !== undefined && maxConcurrency !== undefined) {
      const recommended = recommendLlmConcurrency({ modelSizeGB, maxConcurrency });
      this.llmConfig.concurrency = recommended;
      Logger.info("[LocalAiManager] LLM 并发按可用内存调整", {
        modelId,
        modelSizeGB,
        maxConcurrency,
        recommended,
      });
    }

    const result = await this.channels.llm.send<{ modelName?: string }>("load-llm", this.llmConfig);
    this.llmState = {
      status: "loaded",
      modelName: result?.modelName ?? this.llmConfig.modelId ?? DEFAULT_LLM_CONFIG.modelId,
    };
  }

  /**
   * 卸载本地 LLM
   */
  public async unloadLlmModel(): Promise<void> {
    if (this.llmState.status === "unloaded") return;
    await this.channels.llm.send("unload-llm");
    this.llmState = { status: "unloaded", modelName: this.llmConfig.modelId ?? DEFAULT_LLM_CONFIG.modelId };
  }

  /**
   * 懒加载：确保本地 LLM 已加载
   */
  public async ensureLlmModel(config?: Partial<LlmConfig>): Promise<void> {
    if (this.llmState.status !== "loaded") {
      await this.loadLlmModel(config);
    }
  }

  /**
   * 获取本地 LLM 状态
   */
  public getLlmModelStatus(): ModelState {
    return { ...this.llmState };
  }

  /**
   * 本地 LLM 当前可用的并发度（= 加载时按可用内存夹紧后的 context 池大小）。
   * 供执行器决定有界并发的上限；未加载时以配置上限兜底，至少为 1。
   */
  public getLlmConcurrency(): number {
    const configured = this.llmConfig.concurrency ?? DEFAULT_LLM_CONFIG.concurrency ?? 1;
    return Math.max(1, Math.floor(configured));
  }

  /**
   * 本地 LLM 是否有在途生成请求
   * 供空闲卸载判定使用：推理进行中不得卸载，否则会腰斩正在进行的（尤其流式）生成
   */
  public isLlmBusy(): boolean {
    return this.llmInFlight > 0;
  }

  /**
   * 本地 LLM 文本生成（通过 Worker）
   */
  public async generate(prompt: string, options?: LlmGenerateOptions): Promise<string> {
    // 进入即计为在途，保证整段生成期间 isLlmBusy() 为 true（含加载阶段）
    this.llmInFlight++;
    try {
      await this.ensureLlmModel();
      const result = await this.channels.llm.send<string>("generate", { prompt, options });
      return result;
    } finally {
      this.llmInFlight--;
    }
  }

  /**
   * 本地 LLM 流式文本生成（通过 Worker 逐 token 回调）
   */
  public async generateStream(
    prompt: string,
    options?: LlmGenerateOptions,
    onToken?: (token: string) => void,
  ): Promise<string> {
    // 进入即计为在途，保证整个流式生成期间 isLlmBusy() 为 true
    this.llmInFlight++;
    try {
      await this.ensureLlmModel();
      const id = generateMessageId();
      if (onToken) {
        this.channels.llm.setStreamCallback(id, onToken);
      }
      try {
        return await this.channels.llm.dispatch<string>(id, "generate-stream", { prompt, options });
      } finally {
        this.channels.llm.clearStreamCallback(id);
      }
    } finally {
      this.llmInFlight--;
    }
  }

  /**
   * 执行文本嵌入（通过 Worker）
   */
  public async embed(text: string, pooling?: string, normalize?: boolean): Promise<{ vector: number[]; dimension: number }> {
    await this.ensureEmbeddingModel();
    const result = await this.channels.embedding.send<{ vector: number[]; dimension: number }>("embed", {
      text,
      pooling: pooling || this.embeddingConfig.pooling,
      normalize: normalize ?? this.embeddingConfig.normalize,
    });
    return result;
  }

  /**
   * 执行批量文本嵌入（通过 Worker）
   */
  public async embedBatch(
    texts: string[],
    pooling?: string,
    normalize?: boolean,
  ): Promise<{ vector: number[]; dimension: number }[]> {
    await this.ensureEmbeddingModel();
    const result = await this.channels.embedding.send<{ vector: number[]; dimension: number }[]>("embed-batch", {
      texts,
      pooling: pooling || this.embeddingConfig.pooling,
      normalize: normalize ?? this.embeddingConfig.normalize,
    });
    return result;
  }

  /**
   * 执行文档重排序（通过 Worker）
   */
  public async rerank(query: string, documents: string[]): Promise<{ index: number; score: number }[]> {
    await this.ensureRerankModel();
    const result = await this.channels.reranker.send<{ index: number; score: number }[]>("rerank", { query, documents });
    return result;
  }

  /**
   * 终止所有 Worker
   */
  public async dispose(): Promise<void> {
    await Promise.all(Object.values(this.channels).map((channel) => channel.terminate()));
    this.embeddingState = { status: "unloaded", modelName: this.embeddingConfig.modelName };
    this.rerankState = { status: "unloaded", modelName: this.rerankConfig.modelName };
    this.llmState = { status: "unloaded", modelName: this.llmConfig.modelId ?? DEFAULT_LLM_CONFIG.modelId };
    Logger.info("[LocalAiManager] 已终止");
  }
}

export default LocalAiManager;
export const localAiManager = LocalAiManager.getInstance();