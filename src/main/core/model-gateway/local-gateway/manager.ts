/**
 * 本地 AI 模型管理器
 * 单例模式，负责 Worker 线程生命周期管理及消息调度
 */
import { Worker } from "worker_threads";
import { join } from "path";
import { ModelState, EmbeddingConfig, RerankConfig, LocalAiConfig, DEFAULT_EMBEDDING_CONFIG, DEFAULT_RERANK_CONFIG } from "./types";
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

class LocalAiManager {
  private static instance: LocalAiManager | null = null;

  private worker: Worker | null = null;
  private pendingMessages = new Map<string, PendingResolver>();

  private embeddingConfig: Required<EmbeddingConfig> = { ...DEFAULT_EMBEDDING_CONFIG };
  private rerankConfig: Required<RerankConfig> = { ...DEFAULT_RERANK_CONFIG };

  private embeddingState: ModelState = {
    status: "unloaded",
    modelName: DEFAULT_EMBEDDING_CONFIG.modelName,
  };

  private rerankState: ModelState = {
    status: "unloaded",
    modelName: DEFAULT_RERANK_CONFIG.modelName,
  };

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
  }

  /**
   * 确保 Worker 已启动
   */
  private ensureWorker(): Worker {
    if (!this.worker) {
      // Worker 由 vite 独立打包为 CJS（dist-electron/local-ai-worker.js），
      // 主进程为 CJS 构建，使用 __dirname 解析其绝对路径（import.meta.url 会编译为 undefined）
      this.worker = new Worker(join(__dirname, "local-ai-worker.js"));
      this.worker.on("message", this.handleWorkerMessage.bind(this));
      this.worker.on("error", this.handleWorkerError.bind(this));
      this.worker.on("exit", this.handleWorkerExit.bind(this));
      Logger.info("[LocalAiManager] Worker 线程已启动");
    }
    return this.worker;
  }

  /**
   * 向 Worker 发送消息并等待响应
   */
  private sendMessage<T>(type: string, payload?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const worker = this.ensureWorker();
      const id = generateMessageId();
      this.pendingMessages.set(id, { resolve: resolve as (value: unknown) => void, reject });
      worker.postMessage({ id, type, payload } satisfies WorkerMessage);
    });
  }

  /**
   * 处理 Worker 返回的消息
   */
  private handleWorkerMessage(event: MessageEvent<WorkerResponse>): void {
    const { id, type, payload, error } = event.data;
    const pending = this.pendingMessages.get(id);
    if (!pending) return;
    this.pendingMessages.delete(id);

    if (error) {
      pending.reject(new Error(error));
      return;
    }

    switch (type) {
      case "embedding-loaded":
        this.embeddingState = { status: "loaded", modelName: (payload as { modelName: string }).modelName };
        pending.resolve(payload);
        break;
      case "rerank-loaded":
        this.rerankState = { status: "loaded", modelName: (payload as { modelName: string }).modelName };
        pending.resolve(payload);
        break;
      case "embedding-result":
      case "rerank-result":
        pending.resolve(payload);
        break;
      case "embedding-unloaded":
        this.embeddingState = { status: "unloaded", modelName: this.embeddingConfig.modelName };
        pending.resolve(payload);
        break;
      case "rerank-unloaded":
        this.rerankState = { status: "unloaded", modelName: this.rerankConfig.modelName };
        pending.resolve(payload);
        break;
      case "error":
        pending.reject(new Error(error));
        break;
    }
  }

  /**
   * 处理 Worker 错误
   */
  private handleWorkerError(error: Error): void {
    Logger.error("[LocalAiManager] Worker 线程错误", { error: error.message });
    for (const [id, pending] of this.pendingMessages) {
      pending.reject(error);
      this.pendingMessages.delete(id);
    }
    // 自动重启 Worker
    this.restartWorker();
  }

  /**
   * 处理 Worker 退出
   */
  private handleWorkerExit(code: number): void {
    Logger.warn("[LocalAiManager] Worker 线程退出", { code });
    this.worker = null;
    if (code !== 0) {
      this.restartWorker();
    }
  }

  /**
   * 重启 Worker
   */
  private restartWorker(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    // 延迟重启
    setTimeout(() => {
      try {
        this.ensureWorker();
        Logger.info("[LocalAiManager] Worker 线程已重启");
      } catch (error) {
        Logger.error("[LocalAiManager] Worker 重启失败", { error: String(error) });
      }
    }, 1000);
  }

  // ==================== 公开接口 ====================

  /**
   * 加载嵌入模型
   */
  public async loadEmbeddingModel(config?: Partial<EmbeddingConfig>): Promise<void> {
    if (this.embeddingState.status === "loaded") return;
    const mergedConfig = { ...this.embeddingConfig, ...config };
    await this.sendMessage("load-embedding", mergedConfig);
  }

  /**
   * 加载重排序模型
   */
  public async loadRerankModel(config?: Partial<RerankConfig>): Promise<void> {
    if (this.rerankState.status === "loaded") return;
    const mergedConfig = { ...this.rerankConfig, ...config };
    await this.sendMessage("load-rerank", mergedConfig);
  }

  /**
   * 卸载嵌入模型
   */
  public async unloadEmbeddingModel(): Promise<void> {
    if (this.embeddingState.status === "unloaded") return;
    await this.sendMessage("unload-embedding");
  }

  /**
   * 卸载重排序模型
   */
  public async unloadRerankModel(): Promise<void> {
    if (this.rerankState.status === "unloaded") return;
    await this.sendMessage("unload-rerank");
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
   * 执行文本嵌入（通过 Worker）
   */
  public async embed(text: string, pooling?: string, normalize?: boolean): Promise<{ vector: number[]; dimension: number }> {
    await this.ensureEmbeddingModel();
    const result = await this.sendMessage<{ vector: number[]; dimension: number }>("embed", {
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
    const result = await this.sendMessage<{ vector: number[]; dimension: number }[]>("embed-batch", {
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
    const result = await this.sendMessage<{ index: number; score: number }[]>("rerank", { query, documents });
    return result;
  }

  /**
   * 终止 Worker
   */
  public async dispose(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
    this.pendingMessages.clear();
    this.embeddingState = { status: "unloaded", modelName: this.embeddingConfig.modelName };
    this.rerankState = { status: "unloaded", modelName: this.rerankConfig.modelName };
    Logger.info("[LocalAiManager] 已终止");
  }
}

export default LocalAiManager;
export const localAiManager = LocalAiManager.getInstance();
