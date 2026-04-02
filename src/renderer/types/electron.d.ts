import type { AppConfig, ApiResponse, SystemInfo, NotificationOptions } from '@/shared/types'
import type { LogLevelEnum } from '@/shared/enums'
import type { LogContext } from '@/main/utils/logger'
import type { OpenDialogOptions, OpenDialogReturnValue } from 'electron'

// 定义 IPC API 接口类型（与 preload.ts 保持一致）
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

// 扩展 Window 接口，将 electronAPI 添加到全局 window 对象
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

