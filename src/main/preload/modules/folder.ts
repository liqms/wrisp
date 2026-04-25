import { ipcRenderer } from 'electron'
import type { FolderAPI } from '../types/folder'
import {
  CreateFolderRequest,
  UpdateFolderRequest,
  FolderQueryRequest,
} from '@/shared/types'

export const folderModule: FolderAPI = {
  create: (request: CreateFolderRequest) => ipcRenderer.invoke('folder:create', request),
  getInfo: (id: number) => ipcRenderer.invoke('folder:getInfo', id),
  query: (request: FolderQueryRequest) => ipcRenderer.invoke('folder:query', request),
  getTreeWithStats: (parentId: number) => ipcRenderer.invoke('folder:getTreeWithStats', parentId),
  getSubFoldersAndFiles: (parentId: number) => ipcRenderer.invoke('folder:getSubFoldersAndFiles', parentId),
  update: (id: number, request: UpdateFolderRequest) => ipcRenderer.invoke('folder:update', id, request),
  delete: (id: number) => ipcRenderer.invoke('folder:delete', id),
  batchMove: (ids: number[], newParentId: number | null) => ipcRenderer.invoke('folder:batchMove', ids, newParentId),
}
