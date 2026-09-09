import { OutputModelType, Locale, TaskType } from "@/shared/enums";

export type ModelType = "base" | "core";

export interface AIProvider {
  id: string;
  name: string;
  models: Model[];
  apiKey?: string;
  logoPath?: string;
  baseUrl: string;
  websiteUrl?: string;
  locale: Locale;
  enabled?: boolean;
}

export interface Model {
  id: string;
  name: string;
  outputType: OutputModelType;
  contextLength: number;
  maxTokens: number;
  isInputText: boolean;
  isInputPic: boolean;
  isInputAudio: boolean;
  isInputVideo: boolean;
  structuredOutputs?: boolean;
}

export interface DefaultModel {
  outputType: OutputModelType;
  providerId: string;
  modelId: string;
  /** 关联的创作任务类型；设置后仅对该 taskType 生效，不设置则为该 outputType 的通用默认模型 */
  taskType?: TaskType;
}

export interface ModelConfig {
  aiProviders: AIProvider[];
  defaultModels: DefaultModel[];
  providerPriority: string[];
  enableAiMode?: boolean; // 是否启用本地AI模式
  enableCloudAi?: boolean; // 是否启用云AI
  version: string; // 配置文件版本
  updatedAt: string; // 更新时间
}

/**
 * 厂商模型元信息（从远程资源文件 model-meta/provider-models.json 加载）。
 * 用于补充 /models 接口返回不全的字段（contextLength/maxTokens/多模态能力等）。
 * 所有字段可选，未提供时保留适配器返回的原值。
 */
export interface ModelMeta {
  contextLength?: number;
  maxTokens?: number;
  isInputText?: boolean;
  isInputPic?: boolean;
  isInputAudio?: boolean;
  isInputVideo?: boolean;
  structuredOutputs?: boolean;
  outputType?: OutputModelType;
}

/** model-meta/provider-models.json 文件结构 */
export interface ProviderModelsMeta {
  version: string;
  updatedAt: string;
  providers: Record<string, Record<string, ModelMeta>>;
}
