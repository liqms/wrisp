import { contextBridge, ipcRenderer } from 'electron'
import { modules } from './modules'
import { notificationManager } from './listeners/notification'
import type { ElectronAPI } from './types'

// 创建通用 IPC 方法
const genericIPC = {
  send: (channel: string, data: any) => {
    ipcRenderer.send(channel, data)
  },
  on: (channel: string, callback: (data: any) => void) => {
    ipcRenderer.on(channel, (_, data) => callback(data))
  }
}

// 组合完整的 Electron API
const electronAPI: ElectronAPI = {
  ...modules,
  ...genericIPC,
  onNotification: (callback) => notificationManager.addListener(callback),
  removeNotificationListener: () => notificationManager.removeAllListeners()
}

// 将 Electron API 暴露给渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export { electronAPI }
export type { ElectronAPI } from './types'