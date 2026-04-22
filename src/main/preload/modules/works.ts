import { ipcRenderer } from 'electron'
import type { WorksAPI } from '../types/works'
import { WorkCreate, WorkUpdate } from '@/main/types/db'
import { WorkStatus } from '@/main/types/db'

export const worksModule: WorksAPI = {
  create: (request: WorkCreate) => ipcRenderer.invoke('works:create', request),
  getInfoById: (id: number) => ipcRenderer.invoke('works:getInfoById', id),
  getDetailById: (id: number) => ipcRenderer.invoke('works:getDetailById', id),
  query: (request: Partial<import('@/main/types/db').Work>) => ipcRenderer.invoke('works:query', request),
  findByConditions: (conditions: Partial<{
    targetAudience?: string
    workType?: string
    status?: WorkStatus
    title?: string
  }>) => ipcRenderer.invoke('works:findByConditions', conditions),
  update: (id: number, request: WorkUpdate) => ipcRenderer.invoke('works:update', id, request),
  delete: (id: number) => ipcRenderer.invoke('works:delete', id),
  destroy: (id: number) => ipcRenderer.invoke('works:destroy', id),
  getStatistics: () => ipcRenderer.invoke('works:getStatistics'),
  getWithFoldersAndFiles: (workId: number) => ipcRenderer.invoke('works:getWithFoldersAndFiles', workId),
  batchAssociateWithWork: (workId: number, folderIds: number[], fileIds: number[]) => ipcRenderer.invoke('works:batchAssociateWithWork', workId, folderIds, fileIds),
  batchDisassociateFromWork: (workId: number, folderIds: number[], fileIds: number[]) => ipcRenderer.invoke('works:batchDisassociateFromWork', workId, folderIds, fileIds),
  associateFolderTreeWithWork: (workId: number, folderId: number) => ipcRenderer.invoke('works:associateFolderTreeWithWork', workId, folderId),
  updateStats: (id: number, wordCount: number, chapterCount: number) => ipcRenderer.invoke('works:updateStats', id, wordCount, chapterCount)
}