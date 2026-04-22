import { ipcRenderer } from 'electron'
import type { LoggerAPI } from '../types/logger'
import type { LogLevelEnum } from '@/shared/enums'
import type { LogContext } from '@/main/utils/logger'

export const loggerModule: LoggerAPI = {
  error: (message: string, context?: LogContext) => ipcRenderer.invoke('logger:error', message, context),
  warn: (message: string, context?: LogContext) => ipcRenderer.invoke('logger:warn', message, context),
  info: (message: string, context?: LogContext) => ipcRenderer.invoke('logger:info', message, context),
  debug: (message: string, context?: LogContext) => ipcRenderer.invoke('logger:debug', message, context),
  log: (level: LogLevelEnum, message: string, context?: LogContext) => ipcRenderer.invoke('logger:log', level, message, context)
}