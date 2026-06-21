import { ipcMain } from "electron";
import {
  startSmartTasks,
  cancelSmartTasks,
  pauseSmartTasks,
  resumeSmartTasks,
  getSmartTaskStatus,
  getSmartTaskHistory,
} from "@/main/core/apis/smart-task.api";
import type { ApiResponse } from "@/shared/types";

export function registerSmartTaskHandlers() {
  ipcMain.handle("smart-task:start", async (): Promise<ApiResponse<{ executionId: string }>> => {
    return startSmartTasks();
  });

  ipcMain.handle("smart-task:cancel", async (): Promise<ApiResponse<void>> => {
    return cancelSmartTasks();
  });

  ipcMain.handle("smart-task:pause", async (): Promise<ApiResponse<void>> => {
    return pauseSmartTasks();
  });

  ipcMain.handle("smart-task:resume", async (): Promise<ApiResponse<void>> => {
    return resumeSmartTasks();
  });

  ipcMain.handle("smart-task:status", async (): Promise<ApiResponse<unknown>> => {
    return getSmartTaskStatus();
  });

  ipcMain.handle("smart-task:history", async (): Promise<ApiResponse<unknown>> => {
    return getSmartTaskHistory();
  });
}