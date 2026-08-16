import { ipcMain } from "electron";
import {
  getConfig,
  getValue,
  setValue,
  resetConfig,
  downloadModel,
  checkModelExist,
  reDownloadModel,
  cancelDownload,
} from "@/main/core/apis/model.api";
import type { ApiResponse } from "@/shared/types";
import type { ModelConfig, ModelType } from "@/shared/types/model.types";

export function registerModelHandlers() {
  ipcMain.handle("model:getConfig", async (): Promise<ApiResponse<ModelConfig>> => {
    return getConfig();
  });

  ipcMain.handle(
    "model:getValue",
    async (_, keyPath: string): Promise<ApiResponse<unknown>> => {
      return getValue(keyPath);
    },
  );

  ipcMain.handle(
    "model:setValue",
    async (_, keyPath: string, value: unknown): Promise<ApiResponse<void>> => {
      return setValue(keyPath, value);
    },
  );

  ipcMain.handle("model:resetConfig", async (): Promise<ApiResponse<void>> => {
    return resetConfig();
  });

  ipcMain.handle(
    "model:downloadModel",
    async (_, type: ModelType): Promise<ApiResponse<string>> => {
      return downloadModel(type);
    },
  );

  ipcMain.handle(
    "model:checkModelExist",
    async (): Promise<ApiResponse<Record<string, boolean>>> => {
      return checkModelExist();
    },
  );

  ipcMain.handle(
    "model:reDownloadModel",
    async (_, type: ModelType): Promise<ApiResponse<void>> => {
      return reDownloadModel(type);
    },
  );

  ipcMain.handle(
    "model:cancelDownload",
    async (_, groupId: string): Promise<ApiResponse<void>> => {
      return cancelDownload(groupId);
    },
  );
}