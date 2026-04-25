import { ipcRenderer } from 'electron'
import type { NovelAPI } from '../types/novel'
import {
  CreateNovelRequest,
  UpdateNovelRequest,
  QueryNovelRequest,
  CreateNovelFileRequest,
  UpdateNovelFileRequest,
  QueryNovelFileRequest
} from '@/shared/types'

export const novelModule: NovelAPI = {
  create: (request: CreateNovelRequest) => ipcRenderer.invoke('novel:create', request),
  getInfo: (id: number) => ipcRenderer.invoke('novel:getInfo', id),
  query: (request: QueryNovelRequest) => ipcRenderer.invoke('novel:query', request),
  update: (id: number, request: UpdateNovelRequest) => ipcRenderer.invoke('novel:update', id, request),
  delete: (id: number) => ipcRenderer.invoke('novel:delete', id),
  createFile: (request: CreateNovelFileRequest) => ipcRenderer.invoke('novel:createFile', request),
  queryFiles: (request: QueryNovelFileRequest) => ipcRenderer.invoke('novel:queryFiles', request),
  getFileContent: (id: number) => ipcRenderer.invoke('novel:getFileContent', id),
  updateFileContent: (id: number, request: UpdateNovelFileRequest) => ipcRenderer.invoke('novel:updateFileContent', id, request),
  deleteFile: (id: number) => ipcRenderer.invoke('novel:deleteFile', id),
  moveFiles: (ids: number[], parentId: number) => ipcRenderer.invoke('novel:moveFiles', ids, parentId)
}