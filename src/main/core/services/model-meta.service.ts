import fs from "fs";
import path from "path";
import { configService } from "@/main/core/services/config.service";
import { RESOURCES_DIR } from "@/main/constants/folder.constants";
import { Logger } from "@/main/utils/logger";
import type { ModelMeta, ProviderModelsMeta } from "@/shared/types/model.types";

/**
 * 厂商模型元信息服务。
 *
 * 从工作区 resources/model-meta/provider-models.json 读取由 GitHub 同步下来的
 * 模型元信息（contextLength / maxTokens / 多模态能力等），用于补充各厂商
 * /models 接口返回不全的字段。
 *
 * 文件缺失或解析失败时返回空元信息（不影响运行，仅使用适配器原始数据）。
 */
class ModelMetaService {
  private static instance: ModelMetaService | null = null;
  /** 内存缓存，避免每次 listModels 都读盘 */
  private cache: ProviderModelsMeta | null = null;
  private cachePath: string | null = null;

  private constructor() {}

  public static getInstance(): ModelMetaService {
    if (!ModelMetaService.instance) {
      ModelMetaService.instance = new ModelMetaService();
    }
    return ModelMetaService.instance;
  }

  private workspacePath(): string {
    const ws = (globalThis as Record<string, unknown>).__WRISP_WORKSPACE_PATH__ as string | undefined;
    if (ws && ws.trim() !== "") return ws;
    return configService.getValue<string>("workspace") || "";
  }

  private metaFilePath(): string {
    return path.join(this.workspacePath(), RESOURCES_DIR, "model-meta", "provider-models.json");
  }

  /**
   * 读取并缓存模型元信息文件。
   * 每次调用都会重新检查文件 mtime，文件变更时刷新缓存。
   */
  private getMeta(): ProviderModelsMeta {
    const filePath = this.metaFilePath();
    // 路径变化（工作区切换）时清缓存
    if (this.cachePath !== filePath) {
      this.cache = null;
      this.cachePath = filePath;
    }
    if (this.cache) return this.cache;

    try {
      if (!fs.existsSync(filePath)) {
        this.cache = { version: "0.0.0", updatedAt: "", providers: {} };
        return this.cache;
      }
      const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
      if (!raw || typeof raw !== "object") throw new Error("invalid root");
      const o = raw as Record<string, unknown>;
      const providers = (o.providers && typeof o.providers === "object")
        ? (o.providers as Record<string, Record<string, ModelMeta>>)
        : {};
      this.cache = {
        version: typeof o.version === "string" ? o.version : "0.0.0",
        updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : "",
        providers,
      };
      Logger.info("模型元信息已加载", { providerCount: Object.keys(providers).length, version: this.cache.version });
    } catch (err) {
      Logger.warn("读取模型元信息失败，使用空元信息", { error: String(err) });
      this.cache = { version: "0.0.0", updatedAt: "", providers: {} };
    }
    return this.cache;
  }

  /** 资源同步更新后主动清缓存，下次读取时重新加载 */
  public invalidate(): void {
    this.cache = null;
    Logger.debug("模型元信息缓存已失效");
  }

  /** 获取指定厂商所有模型的元信息 */
  public getProviderModels(providerId: string): Record<string, ModelMeta> {
    return this.getMeta().providers[providerId] ?? {};
  }

  /** 获取指定厂商 + 模型的元信息，不存在返回 null */
  public getModelMeta(providerId: string, modelId: string): ModelMeta | null {
    return this.getProviderModels(providerId)[modelId] ?? null;
  }
}

export const modelMetaService = ModelMetaService.getInstance();
export default ModelMetaService;
