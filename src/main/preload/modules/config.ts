import { ipcRenderer } from 'electron'
import type { ConfigAPI } from '../types/config'
import type { AppConfig } from '@/shared/types'

export const configModule: ConfigAPI = {
  get: () => ipcRenderer.invoke('config:get'),
  set: (config: AppConfig) => ipcRenderer.invoke('config:set', config),
  getValue: (keyPath: string) => ipcRenderer.invoke('config:getValue', keyPath),
  setValue: (keyPath: string, value: any) => ipcRenderer.invoke('config:setValue', keyPath, value),
  getStaticPath: (type?: string) => ipcRenderer.invoke('config:getStaticPath', type),
  reset: () => ipcRenderer.invoke('config:reset')
}