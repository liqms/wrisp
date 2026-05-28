import { Logger } from "@/main/utils/logger";
import { response } from "@/main/utils/response";
import { ErrorCode, LOG_LEVEL } from "@/shared/enums";
import type { ApiResponse } from "@/shared/types";
import type { LogContext } from "@/main/utils/logger";

async function logError(
  message: string,
  context?: LogContext,
): Promise<ApiResponse<void>> {
  try {
    Logger.error(message, context);
    return response.empty();
  } catch (error) {
    Logger.error("日志错误 API 调用失败", { error: JSON.stringify(error) });
    return response.error(ErrorCode.LOG_CREATE_FAILED, error as Error);
  }
}

async function logWarn(
  message: string,
  context?: LogContext,
): Promise<ApiResponse<void>> {
  try {
    Logger.warn(message, context);
    return response.empty();
  } catch (error) {
    Logger.error("日志警告 API 调用失败", { error: JSON.stringify(error) });
    return response.error(ErrorCode.LOG_CREATE_FAILED, error as Error);
  }
}

async function logInfo(
  message: string,
  context?: LogContext,
): Promise<ApiResponse<void>> {
  try {
    Logger.info(message, context);
    return response.empty();
  } catch (error) {
    Logger.error("日志信息 API 调用失败", { error: JSON.stringify(error) });
    return response.error(ErrorCode.LOG_CREATE_FAILED, error as Error);
  }
}

async function logDebug(
  message: string,
  context?: LogContext,
): Promise<ApiResponse<void>> {
  try {
    Logger.debug(message, context);
    return response.empty();
  } catch (error) {
    Logger.error("日志调试 API 调用失败", { error: JSON.stringify(error) });
    return response.error(ErrorCode.LOG_CREATE_FAILED, error as Error);
  }
}

async function log(
  level: LOG_LEVEL,
  message: string,
  context?: LogContext,
): Promise<ApiResponse<void>> {
  try {
    Logger.log(level, message, context);
    return response.empty();
  } catch (error) {
    Logger.error("日志 API 调用失败", { error: JSON.stringify(error) });
    return response.error(ErrorCode.LOG_CREATE_FAILED, error as Error);
  }
}

export { logError, logWarn, logInfo, logDebug, log };
