import { ipcRenderer } from 'electron'
import type { ConfigAPI } from '../types/config'

export const configModule: ConfigAPI = {
  get: () => ipcRenderer.invoke('config:get'),
  getValue: (keyPath: string) => ipcRenderer.invoke('config:getValue', keyPath),
  setValue: (keyPath: string, value: any) => ipcRenderer.invoke('config:setValue', keyPath, value),
  getStaticPath: (type?: string) => ipcRenderer.invoke('config:getStaticPath', type),
  reset: () => ipcRenderer.invoke('config:reset')
}