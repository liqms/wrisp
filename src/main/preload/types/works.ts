import type { ApiResponse } from '@/shared/types'
import { Work, WorkCreate, WorkUpdate, WorkStatus } from '@/main/types/db'

export interface WorksAPI {
  create(request: WorkCreate): Promise<ApiResponse<Work>>
  getInfoById(id: number): Promise<ApiResponse<Work>>
  getDetailById(id: number): Promise<ApiResponse<Work & { folders: import('@/main/types/db').Folder[]; files: import('@/main/types/db').File[] }>>
  query(request: Partial<Work>): Promise<ApiResponse<Work[]>>
  findByConditions(conditions: Partial<{
    targetAudience?: string
    workType?: string
    status?: WorkStatus
    title?: string
  }>): Promise<ApiResponse<Work[]>>
  update(id: number, request: WorkUpdate): Promise<ApiResponse<number>>
  delete(id: number): Promise<ApiResponse<number>>
  destroy(id: number): Promise<ApiResponse<number>>
  getStatistics(): Promise<ApiResponse<{
    total: number
    byStatus: Array<{ status: WorkStatus; count: number }>
    byWorkType: Array<{ work_type: string; count: number }>
    byTargetAudience: Array<{ target_audience: string; count: number }>
  }>>
  getWithFoldersAndFiles(workId: number): Promise<ApiResponse<{ folders: import('@/main/types/db').Folder[]; files: import('@/main/types/db').File[] }>>
  batchAssociateWithWork(workId: number, folderIds: number[], fileIds: number[]): Promise<ApiResponse<{ foldersUpdated: number; filesUpdated: number }>>
  batchDisassociateFromWork(workId: number, folderIds: number[], fileIds: number[]): Promise<ApiResponse<{ foldersUpdated: number; filesUpdated: number }>>
  associateFolderTreeWithWork(workId: number, folderId: number): Promise<ApiResponse<{ foldersUpdated: number; filesUpdated: number }>>
  updateStats(id: number, wordCount: number, chapterCount: number): Promise<ApiResponse<boolean>>
}