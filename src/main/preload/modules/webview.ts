import { ipcRenderer } from 'electron'
import type { WebviewAPI } from '../types/webview'
import type { WebContentViewOptions } from '@/shared/types'

export const webviewModule: WebviewAPI = {
  create: (url: string, options?: WebContentViewOptions) => ipcRenderer.invoke('webview:create', url, options),
  reload: () => ipcRenderer.invoke('webview:reload'),
  destroy: () => ipcRenderer.invoke('webview:destroy'),
  goBack: () => ipcRenderer.invoke('webview:goBack'),
  goForward: () => ipcRenderer.invoke('webview:goForward'),
  getNavigationState: () => ipcRenderer.invoke('webview:getNavigationState'),
}