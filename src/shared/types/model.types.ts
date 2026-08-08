import { OutputModelType, Locale } from "@/shared/enums";

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
