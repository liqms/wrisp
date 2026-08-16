/**
 * 通用任务队列 API 层
 * 封装 TaskQueue 调用，供 IPC handler 使用
 */
import { taskQueue } from "@/main/core/task-queue";
import { response } from "@/main/utils/response";
import type { ApiResponse } from "@/shared/types";
import type { Task, EnqueueTaskInput } from "@/shared/types/task.types";
import { ErrorCode } from "@/shared/enums";
import { Logger } from "@/main/utils/logger";

async function enqueueTask(input: EnqueueTaskInput): Promise<ApiResponse<string>> {
  try {
    const id = await taskQueue.enqueue(input);
    return response.success(id);
  } catch (error) {
    Logger.error("任务入队失败", { error: String(error) });
    return response.error(ErrorCode.TASK_ENQUEUE_FAILED, error as Error);
  }
}

async function getTask(taskId: string): Promise<ApiResponse<Task | null>> {
  try {
    const task = await taskQueue.getTask(taskId);
    return response.success(task);
  } catch (error) {
    Logger.error("获取任务失败", { taskId, error: String(error) });
    return response.error(ErrorCode.TASK_GET_FAILED, error as Error);
  }
}

async function getTasksByGroup(groupId: string): Promise<ApiResponse<Task[]>> {
  try {
    const tasks = await taskQueue.getTasksByGroup(groupId);
    return response.success(tasks);
  } catch (error) {
    Logger.error("查询分组任务失败", { groupId, error: String(error) });
    return response.error(ErrorCode.TASK_GET_GROUP_FAILED, error as Error);
  }
}

async function cancelTask(taskId: string): Promise<ApiResponse<void>> {
  try {
    await taskQueue.cancel(taskId);
    return response.empty();
  } catch (error) {
    Logger.error("取消任务失败", { taskId, error: String(error) });
    return response.error(ErrorCode.TASK_CANCEL_FAILED, error as Error);
  }
}

/** 获取分组进度（按状态统计） */
async function getProgress(groupId: string): Promise<ApiResponse<{
  total: number;
  succeeded: number;
  failed: number;
  pending: number;
  running: number;
}>> {
  try {
    const tasks = await taskQueue.getTasksByGroup(groupId);
    const progress = {
      total: tasks.length,
      succeeded: tasks.filter((t) => t.status === "succeeded").length,
      failed: tasks.filter((t) => t.status === "failed").length,
      pending: tasks.filter((t) => t.status === "pending").length,
      running: tasks.filter((t) => t.status === "running").length,
    };
    return response.success(progress);
  } catch (error) {
    Logger.error("获取进度失败", { groupId, error: String(error) });
    return response.error(ErrorCode.TASK_PROGRESS_FAILED, error as Error);
  }
}

export {
  enqueueTask,
  getTask,
  getTasksByGroup,
  cancelTask,
  getProgress,
};