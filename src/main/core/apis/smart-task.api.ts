/**
 * 智能任务 API 层
 * 封装 SmartTaskScheduler 调用，供 IPC handler 使用
 */
import { smartTaskScheduler } from "@/main/core/smart-tasks";
import { response } from "@/main/utils/response";
import { ApiResponse } from "@/shared/types";
import { Logger } from "@/main/utils/logger";

async function startSmartTasks(): Promise<ApiResponse<{ executionId: string }>> {
  try {
    const result = await smartTaskScheduler.start();
    return response.success(result);
  } catch (error) {
    Logger.error("启动智能任务失败", { error: String(error) });
    return response.error("SMART_TASK_START_FAILED" as any, error as Error);
  }
}

async function cancelSmartTasks(): Promise<ApiResponse<void>> {
  try {
    smartTaskScheduler.cancel();
    return response.empty();
  } catch (error) {
    Logger.error("取消智能任务失败", { error: String(error) });
    return response.error("SMART_TASK_CANCEL_FAILED" as any, error as Error);
  }
}

async function pauseSmartTasks(): Promise<ApiResponse<void>> {
  try {
    smartTaskScheduler.pause();
    return response.empty();
  } catch (error) {
    Logger.error("暂停智能任务失败", { error: String(error) });
    return response.error("SMART_TASK_PAUSE_FAILED" as any, error as Error);
  }
}

async function resumeSmartTasks(): Promise<ApiResponse<void>> {
  try {
    smartTaskScheduler.resume();
    return response.empty();
  } catch (error) {
    Logger.error("恢复智能任务失败", { error: String(error) });
    return response.error("SMART_TASK_RESUME_FAILED" as any, error as Error);
  }
}

async function getSmartTaskStatus(): Promise<ApiResponse<unknown>> {
  try {
    const status = smartTaskScheduler.getStatus();
    return response.success(status);
  } catch (error) {
    Logger.error("获取智能任务状态失败", { error: String(error) });
    return response.error("SMART_TASK_STATUS_FAILED" as any, error as Error);
  }
}

async function getSmartTaskHistory(): Promise<ApiResponse<unknown>> {
  try {
    const history = smartTaskScheduler.getExecutionHistory();
    return response.success(history);
  } catch (error) {
    Logger.error("获取智能任务历史失败", { error: String(error) });
    return response.error("SMART_TASK_HISTORY_FAILED" as any, error as Error);
  }
}

export {
  startSmartTasks,
  cancelSmartTasks,
  pauseSmartTasks,
  resumeSmartTasks,
  getSmartTaskStatus,
  getSmartTaskHistory,
};