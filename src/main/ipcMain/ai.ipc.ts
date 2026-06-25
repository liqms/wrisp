import { ipcMain } from "electron";
import {
  chatCompletion,
  chatCompletionStream,
  getCostSummary,
  getCostRecords,
  getProviders,
  testProviderConnection,
  refreshAIConfig,
  isLocalAvailable,
  isCloudAvailable,
  getRouteStatus,
} from "@/main/core/apis/ai.api";
import type { ApiResponse } from "@/shared/types";
import type { LLMRequest, LLMResponse, CostSummary, CostRecord } from "@/main/core/model-gateway/llm-gateway/types";

export function registerAIHandlers() {
  ipcMain.handle(
    "ai:chatCompletion",
    async (_, request: LLMRequest): Promise<ApiResponse<LLMResponse>> => {
      return chatCompletion(request);
    },
  );

  ipcMain.handle(
    "ai:chatCompletionStream",
    async (event, request: LLMRequest): Promise<ApiResponse<null>> => {
      return chatCompletionStream(event, request);
    },
  );

  ipcMain.handle("ai:getCostSummary", async (): Promise<ApiResponse<CostSummary>> => {
    return getCostSummary();
  });

  ipcMain.handle(
    "ai:getCostRecords",
    async (_, count?: number): Promise<ApiResponse<CostRecord[]>> => {
      return getCostRecords(count);
    },
  );

  ipcMain.handle("ai:getProviders", async (): Promise<ApiResponse<any[]>> => {
    return getProviders();
  });

  ipcMain.handle(
    "ai:testProviderConnection",
    async (_, providerId: string): Promise<ApiResponse<boolean>> => {
      return testProviderConnection(providerId);
    },
  );

  ipcMain.handle("ai:refreshConfig", async (): Promise<ApiResponse<void>> => {
    return refreshAIConfig();
  });

  ipcMain.handle("ai:localAvailable", async (): Promise<ApiResponse<boolean>> => {
    return isLocalAvailable();
  });

  ipcMain.handle("ai:cloudAvailable", async (): Promise<ApiResponse<boolean>> => {
    return isCloudAvailable();
  });

  ipcMain.handle("ai:routeStatus", async (): Promise<ApiResponse<Record<string, unknown>>> => {
    return getRouteStatus();
  });
}