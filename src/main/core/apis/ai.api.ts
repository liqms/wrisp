import { aiService } from "@/main/core/services/ai.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type { ApiResponse } from "@/shared/types";
import type { LLMRequest, LLMResponse, CostSummary, CostRecord } from "@/main/core/model-gateway/llm-gateway/types";
import { Logger } from "@/main/utils/logger";

async function chatCompletion(request: LLMRequest): Promise<ApiResponse<LLMResponse>> {
  try {
    const result = await aiService.chatCompletion(request);
    return response.success(result);
  } catch (error) {
    Logger.error("AI chatCompletion 失败", { error: String(error) });
    return response.error(ErrorCode.AI_REQUEST_FAILED, error as Error);
  }
}

async function getCostSummary(): Promise<ApiResponse<CostSummary>> {
  try {
    const result = aiService.getCostSummary();
    return response.success(result);
  } catch (error) {
    Logger.error("获取 AI 用量统计失败", { error: String(error) });
    return response.error(ErrorCode.AI_REQUEST_FAILED, error as Error);
  }
}

async function getCostRecords(count?: number): Promise<ApiResponse<CostRecord[]>> {
  try {
    const result = aiService.getCostRecords(count);
    return response.success(result);
  } catch (error) {
    Logger.error("获取 AI 用量记录失败", { error: String(error) });
    return response.error(ErrorCode.AI_REQUEST_FAILED, error as Error);
  }
}

async function getProviders(): Promise<ApiResponse<any[]>> {
  try {
    const result = aiService.getProviders();
    return response.success(result);
  } catch (error) {
    Logger.error("获取 AI Provider 列表失败", { error: String(error) });
    return response.error(ErrorCode.AI_REQUEST_FAILED, error as Error);
  }
}

async function testProviderConnection(providerId: string): Promise<ApiResponse<boolean>> {
  try {
    const result = await aiService.testProviderConnection(providerId);
    return response.success(result);
  } catch (error) {
    Logger.error("测试 Provider 连接失败", { error: String(error) });
    return response.error(ErrorCode.AI_REQUEST_FAILED, error as Error);
  }
}

async function refreshAIConfig(): Promise<ApiResponse<void>> {
  try {
    aiService.refreshConfig();
    return response.empty();
  } catch (error) {
    Logger.error("刷新 AI 配置失败", { error: String(error) });
    return response.error(ErrorCode.CONFIG_UPDATE_FAILED, error as Error);
  }
}

async function isLocalAvailable(): Promise<ApiResponse<boolean>> {
  try {
    const result = await aiService.isLocalAvailable();
    return response.success(result);
  } catch (error) {
    Logger.error("检查本地 AI 可用性失败", { error: String(error) });
    return response.error(ErrorCode.AI_REQUEST_FAILED, error as Error);
  }
}

async function isCloudAvailable(): Promise<ApiResponse<boolean>> {
  try {
    const result = aiService.isCloudAvailable();
    return response.success(result);
  } catch (error) {
    Logger.error("检查云端 AI 可用性失败", { error: String(error) });
    return response.error(ErrorCode.AI_REQUEST_FAILED, error as Error);
  }
}

async function getRouteStatus(): Promise<ApiResponse<Record<string, unknown>>> {
  try {
    const result = await aiService.getRouteStatus();
    return response.success(result);
  } catch (error) {
    Logger.error("获取路由状态失败", { error: String(error) });
    return response.error(ErrorCode.AI_REQUEST_FAILED, error as Error);
  }
}

export { chatCompletion, getCostSummary, getCostRecords, getProviders, testProviderConnection, refreshAIConfig, isLocalAvailable, isCloudAvailable, getRouteStatus };