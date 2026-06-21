import { app } from "electron";
import fs from "fs";
import Store from "electron-store";
import path from "path";
import { ModelConfig, ModelType } from "@/shared/types/model.types";
import { DEFAULT_MODEL_CONFIG } from "@/main/constants/model.constants";
import { Logger } from "@/main/utils/logger";
import { downloadService } from "@/main/core/services/download.service";
import { ObjectUtil } from "@/shared/utils";
import { configService } from "@/main/core/services/config.service";
import { taskQueue } from "@/main/core/task-queue";
import type { EnqueueTaskInput } from "@/shared/types/task.types";
import { BUILTIN_MODELS, resolveModelUrl } from "@/main/core/model-gateway/local-gateway/model-registry";
import { notificationService } from "@/main/core/services/notification.service";
import { t } from "@/main/utils/i18n";

class ModelService {
  private static instance: ModelService | null = null;
  private store: Store<ModelConfig>;
  private config: ModelConfig | null = null;
  private userDataPath: string;
  private defaultConfig: ModelConfig | null = null;

  private constructor() {
    this.userDataPath = app.getPath("userData");

    const configDir = path.join(this.userDataPath, "config");
    fs.mkdirSync(configDir, { recursive: true });

    this.defaultConfig = this.getDefaultConfig();

    this.store = new Store<ModelConfig>({
      name: "model",
      cwd: configDir,
      fileExtension: "json",
      clearInvalidConfig: true,
      defaults: this.defaultConfig,
    });

    this.loadConfig();
  }

  /**
   * 获取单例实例
   * @returns ModelService 单例
   */
  public static getInstance(): ModelService {
    if (!ModelService.instance) {
      ModelService.instance = new ModelService();
    }
    Logger.info("获取 ModelService 单例实例");
    return ModelService.instance;
  }

  /**
   * 获取默认模型配置
   * @returns 默认配置对象的深拷贝
   */
  private getDefaultConfig(): ModelConfig {
    return ObjectUtil.deepClone(DEFAULT_MODEL_CONFIG);
  }

  /**
   * 从 electron-store 加载配置，与默认配置合并
   */
  private loadConfig(): void {
    try {
      const storeData = this.store.store;
      const defaultConfig = this.defaultConfig || this.getDefaultConfig();
      this.config = ObjectUtil.deepMerge(defaultConfig, storeData as Partial<ModelConfig>);
      Logger.debug("ModelConfig 加载成功");
    } catch (error) {
      Logger.error("加载 ModelConfig 失败, 使用默认配置", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      this.config = this.defaultConfig || this.getDefaultConfig();
      this.saveConfig();
    }
  }

  /**
   * 将当前配置持久化到 electron-store
   */
  private saveConfig(): void {
    try {
      if (this.config) {
        this.store.set(this.config);
      }
    } catch (error) {
      Logger.error("保存 ModelConfig 失败", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * 获取完整模型配置的深拷贝
   * @returns 当前模型配置
   */
  public getConfig(): ModelConfig {
    if (!this.config) {
      this.loadConfig();
    }
    return ObjectUtil.deepClone(this.config!);
  }

  /**
   * 根据键路径获取配置值
   * @param keyPath - 配置键路径（支持点号分隔的嵌套路径）
   * @returns 配置值或 undefined
   * @template T - 返回值的类型
   */
  public getValue<T>(keyPath: string): T | undefined {
    try {
      const keys = keyPath.split(".");
      let result: any = this.config!;

      for (const key of keys) {
        if (result && typeof result === "object" && key in result) {
          result = result[key];
        } else {
          return undefined;
        }
      }

      return result as T;
    } catch (error) {
      Logger.error("获取配置值失败", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return undefined;
    }
  }

  /**
   * 根据键路径设置配置值
   * @param keyPath - 配置键路径（支持点号分隔的嵌套路径）
   * @param value - 要设置的值
   * @template T - 值的类型
   */
  public setValue<T>(keyPath: string, value: T): void {
    Logger.debug("设置配置值 ModelService", { keyPath, value });
    try {
      // 直接使用 electron-store 的 set 方法，支持点号路径
      this.store.set(keyPath, value as any);
      // 同步更新内存中的配置
      const keys = keyPath.split(".");
      let target: any = this.config!;
      for (let i = 0; i < keys.length - 1; i++) {
        if (target && typeof target === "object" && keys[i] in target) {
          target = target[keys[i]];
        } else {
          Logger.error(`ModelConfig 配置键路径不存在: ${keyPath}`);
          return;
        }
      }
      target[keys[keys.length - 1]] = value;
    } catch (error) {
      Logger.error("ModelConfig 设置配置值失败", {
        keyPath,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * 重置模型配置为默认值
   */
  public resetConfig(): void {
    try {
      this.config = this.defaultConfig || this.getDefaultConfig();
      this.saveConfig();
      Logger.info("ModelConfig 重置为默认值");
    } catch (error) {
      Logger.error("ModelConfig 重置失败", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * 下载 启用本地智能需要的模型文件
   * base 包含jina-embeddings-v3、bge-reranker-v2-m3
   * core 包含Qwen3.5-4B-Instruct(本期不做)
   * 根据语言设置选择国内/国际镜像源，使用 TaskQueue 分发下载任务
   * @param type 模型类型，base 或 core
   * @returns 任务组 ID，前端可按此 ID 订阅进度
   */
  public async downloadModel(type: ModelType): Promise<string> {
    const locale = configService.getValue<string>("general.locale");
    const mirror = locale === "zhCN" ? "zh" : "en";
    const baseDir = "models";
    const groupId = `model-download-${type}-${Date.now()}`;

    // 从模型注册表获取需要下载的模型
    const modelsToDownload = type === "base"
      ? BUILTIN_MODELS.filter((m) => m.family === "embedding" || m.family === "reranker")
      : [];

    if (modelsToDownload.length === 0) {
      return groupId;
    }

    for (const spec of modelsToDownload) {
      const variant = spec.variants.find((v) => v.variantId === spec.defaultVariant);
      if (!variant) continue;

      for (const file of variant.requiredFiles) {
        const url = resolveModelUrl(file.remotePath, mirror);
        const subDir = path.join(baseDir, spec.modelId, path.dirname(file.localPath));

        // 检查文件是否已存在，存在则跳过
        const localFile = path.join(downloadService.getCachePath(), subDir, path.basename(file.localPath));
        if (fs.existsSync(localFile)) {
          Logger.info("模型文件已存在，跳过下载", { model: spec.modelId, name: file.localPath });
          continue;
        }

        const input: EnqueueTaskInput = {
          type: "model:download-file",
          payload: {
            url,
            subDir,
            groupId,
            fileName: path.basename(file.localPath),
          },
          groupId,
          priority: 10,
          maxRetries: 2,
        };

        await taskQueue.enqueue(input);
        Logger.info("模型下载任务入队", { url, subDir, groupId });
      }
    }

    notificationService.info(t("DOWNLOAD.START_DOWNLOAD_MODEL"), { title: t("DOWNLOAD.TITLE") });

    return groupId;
  }

  /**
   * 检查各模型文件是否已下载
   * @returns 按 modelId 分别返回是否已下载
   */
  public async checkModelExist(): Promise<Record<string, boolean>> {
    const baseDir = "models";
    const result: Record<string, boolean> = {};

    const modelsToCheck = BUILTIN_MODELS.filter(
      (m) => m.family === "embedding" || m.family === "reranker",
    );

    for (const spec of modelsToCheck) {
      const variant = spec.variants.find((v) => v.variantId === spec.defaultVariant);
      if (!variant) {
        result[spec.modelId] = false;
        continue;
      }

      let allExist = true;
      for (const file of variant.requiredFiles) {
        const localFile = path.join(downloadService.getCachePath(), baseDir, spec.modelId, file.localPath);
        if (!fs.existsSync(localFile)) {
          allExist = false;
          break;
        }
      }
      result[spec.modelId] = allExist;
    }

    return result;
  }

  /**
   * 取消模型下载
   * 取消指定 groupId 下所有 pending/running 的下载任务
   * @param groupId downloadModel 返回的任务组 ID
   */
  public async cancelDownload(groupId: string): Promise<void> {
    // 1. 取消任务队列中的任务
    const tasks = await taskQueue.getTasksByGroup(groupId);
    for (const task of tasks) {
      if (task.status === "pending" || task.status === "running") {
        await taskQueue.cancel(task.id);
      }
    }

    // 2. 取消 DownloadService 中正在进行的 HTTP 下载
    const cancelledCount = downloadService.cancelByGroup(groupId);
    Logger.info("[ModelService] 取消模型下载", { groupId, taskCount: tasks.length, downloadCount: cancelledCount });

    notificationService.warning(t("DOWNLOAD.CANCEL_DOWNLOAD_MODEL"), { title: t("DOWNLOAD.TITLE") });
  }

  /**
   * 重新下载模型文件
   * 先删除本地模型文件，再重新下载
   * @param type 模型类型，base 或 core
   */
  public async reDownloadModel(type: ModelType): Promise<void> {
    if (type === "base") {
      const cachePath = downloadService.getCachePath();
      const modelIds = BUILTIN_MODELS
        .filter((m) => m.family === "embedding" || m.family === "reranker")
        .map((m) => m.modelId);
      for (const modelId of modelIds) {
        const fullPath = path.join(cachePath, "models", modelId);
        if (fs.existsSync(fullPath)) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          Logger.info("已删除本地模型目录", { path: fullPath });
        }
      }
    }
    this.setValue("enableAiMode", false);
    await this.downloadModel(type);
  }


}

export default ModelService;
export const modelService = ModelService.getInstance();