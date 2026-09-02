import { ipcMain } from "electron";
import { getSyncStatus, syncNow } from "@/main/core/apis/resource.api";
import type { ApiResponse } from "@/shared/types";
import type { SyncStatus, SyncResult } from "@/shared/types/resource.types";

export function registerResourceHandlers() {
  ipcMain.handle("resource:syncStatus", async (): Promise<ApiResponse<SyncStatus>> => getSyncStatus());
  ipcMain.handle("resource:syncNow", async (): Promise<ApiResponse<SyncResult>> => syncNow());
}
