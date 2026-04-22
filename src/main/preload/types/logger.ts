import type { ApiResponse } from '@/shared/types'
import type { LogLevelEnum } from '@/shared/enums'
import type { LogContext } from '@/main/utils/logger'

export interface LoggerAPI {
  error(message: string, context?: LogContext): Promise<ApiResponse<void>>
  warn(message: string, context?: LogContext): Promise<ApiResponse<void>>
  info(message: string, context?: LogContext): Promise<ApiResponse<void>>
  debug(message: string, context?: LogContext): Promise<ApiResponse<void>>
  log(level: LogLevelEnum, message: string, context?: LogContext): Promise<ApiResponse<void>>
}