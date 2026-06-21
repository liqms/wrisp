import { ipcMain } from "electron";
import {
  enqueueTask,
  getTask,
  getTasksByGroup,
  cancelTask,
  getProgress,
} from "@/main/core/apis/task.api";
import type { ApiResponse } from "@/shared/types";
import type { Task, EnqueueTaskInput } from "@/shared/types/task.types";

export function registerTaskHandlers() {
  ipcMain.handle("task:enqueue", async (_event, input: EnqueueTaskInput): Promise<ApiResponse<string>> => {
    return enqueueTask(input);
  });

  ipcMain.handle("task:get", async (_event, taskId: string): Promise<ApiResponse<Task | null>> => {
    return getTask(taskId);
  });

  ipcMain.handle("task:getByGroup", async (_event, groupId: string): Promise<ApiResponse<Task[]>> => {
    return getTasksByGroup(groupId);
  });

  ipcMain.handle("task:cancel", async (_event, taskId: string): Promise<ApiResponse<void>> => {
    return cancelTask(taskId);
  });

  ipcMain.handle("task:progress", async (_event, groupId: string): Promise<ApiResponse<{
    total: number;
    succeeded: number;
    failed: number;
    pending: number;
    running: number;
  }>> => {
    return getProgress(groupId);
  });
}