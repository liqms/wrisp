import { ipcMain } from "electron";
import {
  getConfig,
  getValue,
  setValue,
  resetConfig,
  setWorkspace,
} from "@/main/core/apis/config.api";
import type { ApiResponse } from "@/shared/types";
import type { AppConfig } from "@/main/types";

export function registerConfigHandlers() {
  ipcMain.handle("config:get", async (): Promise<ApiResponse<AppConfig>> => {
    return getConfig();
  });

  ipcMain.handle(
    "config:getValue",
    async (_, keyPath: string): Promise<ApiResponse<any>> => {
      return getValue(keyPath);
    },
  );

  ipcMain.handle(
    "config:setValue",
    async (_, keyPath: string, value: any): Promise<ApiResponse<void>> => {
      return setValue(keyPath, value);
    },
  );

  ipcMain.handle("config:reset", async (): Promise<ApiResponse<void>> => {
    return resetConfig();
  });

  ipcMain.handle(
    "config:setWorkspace",
    async (_, workspacePath: string): Promise<ApiResponse<void>> => {
      return setWorkspace(workspacePath);
    },
  );
}
