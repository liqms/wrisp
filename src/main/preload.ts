import { contextBridge, ipcRenderer,OpenDialogOptions, OpenDialogReturnValue } from 'electron'
import type { AppConfig, ApiResponse, SystemInfo, NotificationOptions } from '@/shared/types'
import type { LogLevelEnum } from '@/shared/enums'
import type { LogContext } from '@/main/utils/logger'

// 定义 IPC API 接口类型
export interface ElectronAPI {
  // 配置管理
  config: {
    get(): Promise<ApiResponse<AppConfig>>
    set(config: Partial<AppConfig>): Promise<ApiResponse<void>>
    getValue(keyPath: string): Promise<ApiResponse<any>>
    setValue(keyPath: string, value: any): Promise<ApiResponse<void>>
    getStaticPath(): Promise<ApiResponse<string>>
    reset(): Promise<ApiResponse<void>>
  }

  // 通知管理
  notification: {
    info(message: string, options?: NotificationOptions): Promise<ApiResponse<void>>
    success(message: string, options?: NotificationOptions): Promise<ApiResponse<void>>
    warning(message: string, options?: NotificationOptions): Promise<ApiResponse<void>>
    error(message: string, options?: NotificationOptions): Promise<ApiResponse<void>>
  }

  // 窗口控制
  window: {
    minimize(): Promise<void>
    maximize(): Promise<void>
    close(): Promise<void>
    isMaximized(): Promise<boolean>
  }

  // 系统功能
  system: {
    getSystemInfo(): Promise<ApiResponse<SystemInfo>>
    showSystemNotification(title: string, body: string): Promise<ApiResponse<void>>
    openDialog(options: OpenDialogOptions): Promise<ApiResponse<OpenDialogReturnValue>>
  }

  // 日志管理
  logger: {
    error(message: string, context?: LogContext): Promise<ApiResponse<void>>
    warn(message: string, context?: LogContext): Promise<ApiResponse<void>>
    info(message: string, context?: LogContext): Promise<ApiResponse<void>>
    debug(message: string, context?: LogContext): Promise<ApiResponse<void>>
    log(level: LogLevelEnum, message: string, context?: LogContext): Promise<ApiResponse<void>>
  }

  // WebView 相关
  webview: {
    create(url: string): Promise<ApiResponse<void>>
    reload(): Promise<ApiResponse<void>>
    destroy(): Promise<ApiResponse<void>>
    goBack(): Promise<ApiResponse<void>>
    goForward(): Promise<ApiResponse<void>>
  }

  // 通用 IPC 方法（保持向后兼容）
  send: (channel: string, data: any) => void
  on: (channel: string, callback: (data: any) => void) => void
}

// 创建 IPC API 实现
const electronAPI: ElectronAPI = {
  // 配置管理
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (config: Partial<AppConfig>) => ipcRenderer.invoke('config:set', config),
    getValue: (keyPath: string) => ipcRenderer.invoke('config:getValue', keyPath),
    setValue: (keyPath: string, value: any) => ipcRenderer.invoke('config:setValue', keyPath, value),
    getStaticPath: () => ipcRenderer.invoke('config:getStaticPath'),
    reset: () => ipcRenderer.invoke('config:reset')
  },

  // 通知管理
  notification: {
    info: (message: string, options?: NotificationOptions) => ipcRenderer.invoke('notification:info', message, options),
    success: (message: string, options?: NotificationOptions) => ipcRenderer.invoke('notification:success', message, options),
    warning: (message: string, options?: NotificationOptions) => ipcRenderer.invoke('notification:warning', message, options),
    error: (message: string, options?: NotificationOptions) => ipcRenderer.invoke('notification:error', message, options)
  },

  // 窗口控制
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized')
  },

  // 系统功能
  system: {
    getSystemInfo: () => ipcRenderer.invoke('system:getSystemInfo'),
    showSystemNotification: (title: string, body: string) => ipcRenderer.invoke('system:showSystemNotification', title, body),
    openDialog: (options: OpenDialogOptions) => ipcRenderer.invoke('system:openDialog', options)
  },

  // 日志管理
  logger: {
    error: (message: string, context?: LogContext) => ipcRenderer.invoke('logger:error', message, context),
    warn: (message: string, context?: LogContext) => ipcRenderer.invoke('logger:warn', message, context),
    info: (message: string, context?: LogContext) => ipcRenderer.invoke('logger:info', message, context),
    debug: (message: string, context?: LogContext) => ipcRenderer.invoke('logger:debug', message, context),
    log: (level: LogLevelEnum, message: string, context?: LogContext) => ipcRenderer.invoke('logger:log', level, message, context)
  },

  // WebView 相关
  webview: {
    create: (url: string) => ipcRenderer.invoke('webview:create', url),
    reload: () => ipcRenderer.invoke('webview:reload'),
    destroy: () => ipcRenderer.invoke('webview:destroy'),
    goBack: () => ipcRenderer.invoke('webview:goBack'),
    goForward: () => ipcRenderer.invoke('webview:goForward')
  },

  // 通用 IPC 方法（保持向后兼容）
  send: (channel: string, data: any) => {
    ipcRenderer.send(channel, data)
  },
  on: (channel: string, callback: (data: any) => void) => {
    ipcRenderer.on(channel, (_, data) => callback(data))
  }
}

// 将 Electron API 暴露给渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI)