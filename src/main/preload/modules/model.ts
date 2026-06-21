import { ipcRenderer } from 'electron'
import type { ModelAPI } from '../types/model'

export const modelModule: ModelAPI = {
  getConfig: () => ipcRenderer.invoke('model:getConfig'),
  getValue: (keyPath) => ipcRenderer.invoke('model:getValue', keyPath),
  setValue: (keyPath, value) => ipcRenderer.invoke('model:setValue', keyPath, value),
  resetConfig: () => ipcRenderer.invoke('model:resetConfig'),
  downloadModel: (type) => ipcRenderer.invoke('model:downloadModel', type),
  checkModelExist: () => ipcRenderer.invoke('model:checkModelExist'),
  reDownloadModel: (type) => ipcRenderer.invoke('model:reDownloadModel', type),
  cancelDownload: (groupId) => ipcRenderer.invoke('model:cancelDownload', groupId),
}