import { AIProvider, DefaultModel } from "@/shared/types/model.types";
import type { Model } from "@/shared/types/model.types";
import { OutputModelType, TaskType } from "@/shared/enums";

export type { AIProvider, Model, DefaultModel };

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  model?: string;
  taskType?: TaskType;
  outputType?: OutputModelType;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  stream?: boolean;
}

export interface LLMResponse {
  id: string;
  model: string;
  providerId: string;
  content: string;
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMStreamChunk {
  content: string;
  finishReason: string | null;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
}

export interface LLMGatewayConfig {
  providers: AIProvider[];
  providerPriority: string[];
  defaultModels: DefaultModel[];
  failoverConfig: FailoverConfig;
}

export interface FailoverConfig {
  maxRetries: number;
  retryDelayMs: number;
  circuitBreakerThreshold: number;
  cooldownMs: number;
}

export interface AdapterInfo {
  providerId: string;
  adapter: import("./adapters/base.adapter").BaseAdapter;
  provider: AIProvider;
  models: Model[];
  isHealthy: boolean;
}

export interface CostRecord {
  timestamp: number;
  providerId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CostSummary {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  records: CostRecord[];
}
