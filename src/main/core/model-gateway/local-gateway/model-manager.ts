/**
 * 模型管理器
 * 单例模式，管理本地模型的生命周期：下载、加载、卸载、空闲回收
 */
import fs from "fs";
import path from "path";
import { Logger } from "@/main/utils/logger";
import { configService } from "@/main/core/services/system/config.service";
import { downloadService } from "@/main/core/services/system/download.service";
import { MODELS_DIR } from "@/main/constants/folder.constants";
import { localAiManager } from "./manager";
import { ModelState } from "./types";
import {
  ModelSpec,
  MirrorType,
  BUILTIN_MODELS,
  getModelSpec,
  resolveModelUrl,
} from "./model-registry";

/** 文件检查结果 */
export interface CheckResult {
  complete: boolean;
  missingFiles: string[];
}

/** 下载进度 */
export interface DownloadProgress {
  modelId: string;
  fileName: string;
  progress: number;
}

class ModelManager {
  private static instance: ModelManager | null = null;

  private modelsBasePath: string;
  private idleTimeoutMs = 5 * 60 * 1000; // 默认 5 分钟
  private idleTimers = new Map<string, NodeJS.Timeout>();
  /** 单模型空闲超时覆盖（ms），优先于全局 idleTimeoutMs */
  private idleTimeoutOverrides = new Map<string, number>();
  private idleTimerHandle: NodeJS.Timeout | null = null;
  private idleTimerRunning = false;

  /** 初始化模型存储路径 */
  private constructor() {
    // 与下载落盘路径保持一致：downloadService 以 <userData>/Cache 为根，
    // 模型统一写入其下 models/ 目录（见 model.service 的下载逻辑）。
    this.modelsBasePath = path.join(downloadService.getCachePath(), MODELS_DIR);
    fs.mkdirSync(this.modelsBasePath, { recursive: true });
  }

  /** 获取 ModelManager 单例实例 */
  public static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  }

  /** 获取本地模型根目录（绝对路径）——与下载产物落盘位置一致 */
  public getModelsBasePath(): string {
    return this.modelsBasePath;
  }

  // ==================== 规格查询 ====================

  /** 获取模型规格 */
  public getModelSpec(modelId: string): ModelSpec | undefined {
    return getModelSpec(modelId);
  }

  /** 获取所有模型规格 */
  public getAllModelSpecs(): ModelSpec[] {
    return [...BUILTIN_MODELS];
  }

  // ==================== 文件路径管理 ====================

  /** 获取模型在磁盘上的存储路径（下载布局为 <modelsBasePath>/<modelId>，不含变体层级） */
  public getModelPath(modelId: string): string {
    const spec = getModelSpec(modelId);
    if (!spec) throw new Error(`未知模型: ${modelId}`);
    return path.join(this.modelsBasePath, modelId);
  }

  /** 获取当前 locale 对应的镜像类型 */
  private getMirrorType(): MirrorType {
    const locale = configService.getValue<string>("general.locale");
    return locale === "zhCN" ? "zh" : "en";
  }

  // ==================== 文件管理 ====================

  /** 检查模型文件是否已下载完整 */
  public async checkModelFiles(modelId: string, variantId?: string): Promise<CheckResult> {
    const spec = getModelSpec(modelId);
    if (!spec) return { complete: false, missingFiles: [`未知模型: ${modelId}`] };

    const variant = spec.variants.find((v) => v.variantId === (variantId || spec.defaultVariant));
    if (!variant) return { complete: false, missingFiles: [`未知变体: ${variantId}`] };

    const modelPath = this.getModelPath(modelId);
    const missingFiles: string[] = [];

    for (const file of variant.requiredFiles) {
      const fullPath = path.join(modelPath, file.localPath);
      if (!fs.existsSync(fullPath)) {
        missingFiles.push(file.localPath);
      }
    }

    return { complete: missingFiles.length === 0, missingFiles };
  }

  /** 下载模型文件 */
  public async downloadModel(
    modelId: string,
    variantId?: string,
    onProgress?: (progress: DownloadProgress) => void,
  ): Promise<void> {
    const spec = getModelSpec(modelId);
    if (!spec) throw new Error(`未知模型: ${modelId}`);

    const variant = spec.variants.find((v) => v.variantId === (variantId || spec.defaultVariant));
    if (!variant) throw new Error(`未知变体: ${variantId || spec.defaultVariant}`);

    const mirror = this.getMirrorType();
    Logger.info("[ModelManager] 开始下载模型", { modelId, variant: variant.variantId, mirror });

    for (const file of variant.requiredFiles) {
      const url = resolveModelUrl(file.remotePath, mirror);
      const subDir = path.join(MODELS_DIR, modelId, path.dirname(file.localPath));

      Logger.info("[ModelManager] 下载模型文件", { url, subDir });

      try {
        await downloadService.download(url, subDir);
        if (onProgress) {
          onProgress({ modelId, fileName: file.localPath, progress: 100 });
        }
      } catch (error) {
        Logger.error("[ModelManager] 模型文件下载失败", {
          url,
          subDir,
          modelId,
          error: String(error),
        });
        throw error;
      }
    }

    Logger.info("[ModelManager] 模型下载完成", { modelId, variant: variant.variantId });
  }

  /** 删除模型文件 */
  public async removeModel(modelId: string): Promise<void> {
    const modelPath = path.join(this.modelsBasePath, modelId);
    if (fs.existsSync(modelPath)) {
      fs.rmSync(modelPath, { recursive: true, force: true });
      Logger.info("[ModelManager] 已删除模型目录", { path: modelPath });
    }
  }

  // ==================== 加载/卸载 ====================

  /** 加载模型 */
  public async loadModel(modelId: string, _variantId?: string): Promise<void> {
    const spec = getModelSpec(modelId);
    if (!spec) throw new Error(`未知模型: ${modelId}`);

    switch (spec.family) {
      case "embedding":
        await localAiManager.loadEmbeddingModel({ modelName: `Xenova/${modelId}` });
        break;
      case "reranker":
        await localAiManager.loadRerankModel({ modelName: `Xenova/${modelId}` });
        break;
      case "llm":
        await localAiManager.loadLlmModel({ modelPath: this.getModelPath(modelId), modelId });
        break;
      default:
        throw new Error(`不支持的模型类型: ${spec.family}`);
    }
  }

  /** 卸载模型 */
  public async unloadModel(modelId: string): Promise<void> {
    const spec = getModelSpec(modelId);
    if (!spec) throw new Error(`未知模型: ${modelId}`);

    // 清除空闲计时器
    const timer = this.idleTimers.get(modelId);
    if (timer) {
      clearTimeout(timer);
      this.idleTimers.delete(modelId);
    }

    switch (spec.family) {
      case "embedding":
        await localAiManager.unloadEmbeddingModel();
        break;
      case "reranker":
        await localAiManager.unloadRerankModel();
        break;
      case "llm":
        await localAiManager.unloadLlmModel();
        break;
    }
  }

  /** 卸载所有模型 */
  public async unloadAll(): Promise<void> {
    await localAiManager.unloadEmbeddingModel();
    await localAiManager.unloadRerankModel();
    await localAiManager.unloadLlmModel();
    for (const [, timer] of this.idleTimers) {
      clearTimeout(timer);
    }
    this.idleTimers.clear();
  }

  // ==================== 状态查询 ====================

  /** 获取模型状态 */
  public getModelStatus(modelId: string): ModelState | undefined {
    const spec = getModelSpec(modelId);
    if (!spec) return undefined;

    switch (spec.family) {
      case "embedding":
        return localAiManager.getEmbeddingModelStatus();
      case "reranker":
        return localAiManager.getRerankModelStatus();
      case "llm":
        return localAiManager.getLlmModelStatus();
      default:
        return undefined;
    }
  }

  /** 获取所有模型状态 */
  public getAllModelStatus(): Record<string, ModelState> {
    const result: Record<string, ModelState> = {};
    for (const spec of BUILTIN_MODELS) {
      const status = this.getModelStatus(spec.modelId);
      if (status) result[spec.modelId] = status;
    }
    return result;
  }

  // ==================== 空闲卸载 ====================

  /** 设置空闲超时时间 */
  public setIdleTimeout(ms: number): void {
    this.idleTimeoutMs = ms;
  }

  /**
   * 为单个模型覆盖空闲超时（ms）。
   * 用于搜索这类高频短任务：冷启动成本远高于常驻成本，需延长保留期避免反复冷启动。
   */
  public setIdleTimeoutFor(modelId: string, ms: number): void {
    this.idleTimeoutOverrides.set(modelId, ms);
  }

  /** 清除单个模型的空闲超时覆盖，回退到全局 idleTimeoutMs */
  public clearIdleTimeoutOverride(modelId: string): void {
    this.idleTimeoutOverrides.delete(modelId);
  }

  /** 该模型是否被显式设置了空闲保留期（如搜索预热），设置后不宜被立即释放 */
  public hasIdleTimeoutOverride(modelId: string): boolean {
    return this.idleTimeoutOverrides.has(modelId);
  }

  /** 更新模型最后使用时间 */
  public touchModel(modelId: string): void {
    const timeoutMs = this.idleTimeoutOverrides.get(modelId) ?? this.idleTimeoutMs;
    if (timeoutMs <= 0) return;

    const existing = this.idleTimers.get(modelId);
    if (existing) clearTimeout(existing);

    this.idleTimers.set(
      modelId,
      setTimeout(() => {
        const spec = getModelSpec(modelId);
        // 本地 LLM 存在在途生成请求时不发起卸载：避免空闲卸载腰斩正在进行的（尤其流式）生成。
        // 此处不空洞地跳过，而是重新调度一次空闲计时器，待推理真正结束后再判定卸载，
        // 否则若生成结束后无新请求，模型将永远不会被空闲回收。
        if (spec?.family === "llm" && localAiManager.isLlmBusy()) {
          Logger.info("[ModelManager] 本地 LLM 推理进行中，跳过本次空闲卸载", { modelId });
          this.touchModel(modelId);
          return;
        }

        Logger.info("[ModelManager] 空闲超时，卸载模型", { modelId });
        this.unloadModel(modelId).catch((error) => {
          Logger.error("[ModelManager] 空闲卸载失败", { modelId, error: String(error) });
        });
      }, timeoutMs),
    );
  }

  /** 启动空闲检查定时器 */
  public startIdleTimer(intervalMs: number = 60_000): void {
    if (this.idleTimerRunning) return;
    this.idleTimerRunning = true;

    this.idleTimerHandle = setInterval(() => {
      // 定期检查并清理已卸载模型的计时器
      for (const [modelId, timer] of this.idleTimers) {
        const spec = getModelSpec(modelId);
        if (!spec) continue;

        let isLoaded = false;
        switch (spec.family) {
          case "embedding":
            isLoaded = localAiManager.getEmbeddingModelStatus().status === "loaded";
            break;
          case "reranker":
            isLoaded = localAiManager.getRerankModelStatus().status === "loaded";
            break;
          case "llm":
            isLoaded = localAiManager.getLlmModelStatus().status === "loaded";
            break;
        }

        if (!isLoaded) {
          clearTimeout(timer);
          this.idleTimers.delete(modelId);
        }
      }
    }, intervalMs);
  }

  /** 停止空闲检查定时器 */
  public stopIdleTimer(): void {
    if (this.idleTimerHandle) {
      clearInterval(this.idleTimerHandle);
      this.idleTimerHandle = null;
    }
    this.idleTimerRunning = false;
  }

  // ==================== 清理 ====================

  /** 释放资源 */
  public async dispose(): Promise<void> {
    this.stopIdleTimer();
    await this.unloadAll();
  }
}

export default ModelManager;
export const modelManager = ModelManager.getInstance();