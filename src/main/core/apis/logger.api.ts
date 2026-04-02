import { Logger } from '@/main/utils/logger';
import { response } from "@/main/utils/response";
import { ErrorCode, LogLevelEnum } from "@/shared/enums";
import type { ApiResponse } from "@/shared/types";
import type { LogContext } from '@/main/utils/logger';



async function logError(message: string, context?: LogContext): Promise<ApiResponse<void>> {
  try {
    Logger.error(message, context)
    return response.empty();
  } catch (error) {
    return response.error(ErrorCode.LOG_OPERATION_FAILED, error as Error);
  }
}

async function logWarn(message: string, context?: LogContext): Promise<ApiResponse<void>> {
  try {
    Logger.warn(message, context)
    return response.empty();
  } catch (error) {
    return response.error(ErrorCode.LOG_OPERATION_FAILED, error as Error);
  }
}

async function logInfo(message: string, context?: LogContext): Promise<ApiResponse<void>> {
  try {
    Logger.info(message, context)
    return response.empty();
  } catch (error) {
    return response.error(ErrorCode.LOG_OPERATION_FAILED, error as Error);
  }
}

async function logDebug(message: string, context?: LogContext): Promise<ApiResponse<void>> {
  try {
    Logger.debug(message, context)
    return response.empty();
  } catch (error) {
    return response.error(ErrorCode.LOG_OPERATION_FAILED, error as Error);
  }
}

async function log(level: LogLevelEnum, message: string, context?: LogContext): Promise<ApiResponse<void>> {
  try {
    Logger.log(level, message, context)
    return response.empty();
  } catch (error) {
    return response.error(ErrorCode.LOG_OPERATION_FAILED, error as Error);
  }
}

export {
  logError,
  logWarn,
  logInfo,
  logDebug,
  log
}

