import type { ApiResponse } from "@/shared/types";
import type { LLMRequest, LLMResponse, LLMStreamChunk, CostSummary, CostRecord } from "@/main/core/model-gateway/llm-gateway/types";

export interface AIAPI {
  chatCompletion(request: LLMRequest): Promise<ApiResponse<LLMResponse>>;
  chatCompletionStream(request: LLMRequest): Promise<ApiResponse<null>>;
  onChatStreamChunk(callback: (chunk: LLMStreamChunk) => void): () => void;
  onChatStreamDone(callback: () => void): () => void;
  onChatStreamError(callback: (error: string) => void): () => void;
  getCostSummary(): Promise<ApiResponse<CostSummary>>;
  getCostRecords(count?: number): Promise<ApiResponse<CostRecord[]>>;
  getProviders(): Promise<ApiResponse<Array<{ providerId: string; providerName: string; models: unknown[]; isHealthy: boolean; enabled: boolean }>>>;
  testProviderConnection(providerId: string): Promise<ApiResponse<boolean>>;
  refreshConfig(): Promise<ApiResponse<void>>;
  isLocalAvailable(): Promise<ApiResponse<boolean>>;
  isCloudAvailable(): Promise<ApiResponse<boolean>>;
  getRouteStatus(): Promise<ApiResponse<Record<string, unknown>>>;
}