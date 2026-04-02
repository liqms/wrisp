import { ipcMain } from 'electron'
import { logError, logWarn, logInfo, logDebug, log } from '@/main/core/apis/logger.api'
import type { LogContext } from '@/main/utils/logger'
import type { ApiResponse } from '@/shared/types'
import { LogLevelEnum } from '@/shared/enums'

export function registerLoggerHandlers(): void {
  ipcMain.handle('logger:error', async (_, message: string, context?: LogContext): Promise<ApiResponse<void>> => {
    return await logError(message, context)
  })

  ipcMain.handle('logger:warn', async (_, message: string, context?: LogContext): Promise<ApiResponse<void>> => {
    return await logWarn(message, context)
  })

  ipcMain.handle('logger:info', async (_, message: string, context?: LogContext): Promise<ApiResponse<void>> => {
    return await logInfo(message, context)
  })

  ipcMain.handle('logger:debug', async (_, message: string, context?: LogContext): Promise<ApiResponse<void>> => {
    return await logDebug(message, context)
  })

  ipcMain.handle('logger:log', async (_, level: LogLevelEnum, message: string, context?: LogContext): Promise<ApiResponse<void>> => {
    return await log(level, message, context)
  })
}