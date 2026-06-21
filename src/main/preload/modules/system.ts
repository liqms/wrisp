import { ipcRenderer } from 'electron'
import type { SystemAPI } from '../types/system'
import type { NotificationLevel } from '@/shared/types'
import type { OpenDialogOptions } from 'electron'

export const systemModule: SystemAPI = {
  getSystemInfo: () => ipcRenderer.invoke('system:getSystemInfo'),
  showSystemNotification: (level: NotificationLevel, title: string, body: string) =>
    ipcRenderer.invoke('system:showSystemNotification', level, title, body),
  openDialog: (options: OpenDialogOptions) => ipcRenderer.invoke('system:openDialog', options),
  openExternal: (url: string) => ipcRenderer.invoke('system:openExternal', url),
}