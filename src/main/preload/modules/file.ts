import { ipcRenderer } from 'electron'
import type { FileAPI } from '../types/file'

export const fileModule: FileAPI = {
  move: (ids: number[], newFolderId: number) => ipcRenderer.invoke('file:move', { ids, newFolderId }),
}
