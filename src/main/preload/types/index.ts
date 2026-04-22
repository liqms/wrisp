import type { ConfigAPI } from './config'
import type { WindowAPI } from './window'
import type { SystemAPI } from './system'
import type { LoggerAPI } from './logger'
import type { WebviewAPI } from './webview'
import type { FolderAPI } from './folder'
import type { FileAPI } from './file'
import type { WorksAPI } from './works'
import type { NovelAPI } from './novel'

export interface ElectronAPI {
  config: ConfigAPI
  window: WindowAPI
  system: SystemAPI
  logger: LoggerAPI
  webview: WebviewAPI
  folder: FolderAPI
  file: FileAPI
  novel: NovelAPI
  
  // 通用 IPC 方法（保持向后兼容）
  send: (channel: string, data: any) => void
  on: (channel: string, callback: (data: any) => void) => void
  
  // 通知监听器
  onNotification: (callback: (notification: any) => void) => () => void
  removeNotificationListener: () => void
}

export type { ConfigAPI, WindowAPI, SystemAPI, LoggerAPI, WebviewAPI, FolderAPI, FileAPI, WorksAPI, NovelAPI }