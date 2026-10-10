import { AIProvider, DefaultModel } from "@/shared/types/model.types";
import type { Model } from "@/shared/types/model.types";
import { OutputModelType, TaskType } from "@/shared/enums";

export type { AIProvider, Model, DefaultModel };

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
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
  /**
   * 后台批量任务（智能整理等）发起的请求。
   * 并发槽位优先级按「是否用户交互」判定：携带 taskType 不等于用户在等，
   * 智能整理的摘要/概念/主题任务都带 taskType，若按 taskType 判优先级会与用户请求抢槽。
   */
  background?: boolean;
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
}

export interface LLMResponse {
  id: string;
  model: string;
  providerId: string;
  content: string;
  finishReason: string;
  toolCalls?: ToolCall[];
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
