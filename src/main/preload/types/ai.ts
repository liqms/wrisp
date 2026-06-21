import type { ApiResponse } from "@/shared/types";
import type { LLMRequest, LLMResponse, CostSummary, CostRecord } from "@/main/core/model-gateway/llm-gateway/types";

export interface AIAPI {
  chatCompletion(request: LLMRequest): Promise<ApiResponse<LLMResponse>>;
  getCostSummary(): Promise<ApiResponse<CostSummary>>;
  getCostRecords(count?: number): Promise<ApiResponse<CostRecord[]>>;
  getProviders(): Promise<ApiResponse<Array<{ providerId: string; providerName: string; models: any[]; isHealthy: boolean; enabled: boolean }>>>;
  testProviderConnection(providerId: string): Promise<ApiResponse<boolean>>;
  refreshConfig(): Promise<ApiResponse<void>>;
  isLocalAvailable(): Promise<ApiResponse<boolean>>;
  isCloudAvailable(): Promise<ApiResponse<boolean>>;
  getRouteStatus(): Promise<ApiResponse<Record<string, unknown>>>;
}