import { ipcRenderer } from 'electron'
import type { NovelAPI } from '../types/novel'
import {
  CreateNovelRequest,
  UpdateNovelRequest,
  NovelQueryRequest,
  CreateChapterRequest,
  UpdateChapterRequest,
  ChapterQueryRequest
} from '@/shared/types'

export const novelModule: NovelAPI = {
  create: (request: CreateNovelRequest) => ipcRenderer.invoke('novel:create', request),
  getInfo: (id: number) => ipcRenderer.invoke('novel:getInfo', id),
  query: (request: NovelQueryRequest) => ipcRenderer.invoke('novel:query', request),
  update: (id: number, request: UpdateNovelRequest) => ipcRenderer.invoke('novel:update', id, request),
  delete: (id: number) => ipcRenderer.invoke('novel:delete', id),
  createChapter: (request: CreateChapterRequest) => ipcRenderer.invoke('novel:createChapter', request),
  queryChapters: (request: ChapterQueryRequest) => ipcRenderer.invoke('novel:queryChapters', request),
  getChapterContent: (id: number) => ipcRenderer.invoke('novel:getChapterContent', id),
  updateChapterContent: (id: number, request: UpdateChapterRequest) => ipcRenderer.invoke('novel:updateChapterContent', id, request),
  deleteChapter: (id: number) => ipcRenderer.invoke('novel:deleteChapter', id)
}