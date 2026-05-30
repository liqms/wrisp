import { ipcMain } from "electron";
import {
  chatCompletion,
  getCostSummary,
  getCostRecords,
  getProviders,
  testProviderConnection,
  refreshAIConfig,
} from "@/main/core/apis/ai.api";
import type { ApiResponse } from "@/shared/types";
import type { LLMRequest, LLMResponse, CostSummary, CostRecord } from "@/main/core/llm-gateway/types";

export function registerAIHandlers() {
  ipcMain.handle(
    "ai:chatCompletion",
    async (_, request: LLMRequest): Promise<ApiResponse<LLMResponse>> => {
      return chatCompletion(request);
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
}