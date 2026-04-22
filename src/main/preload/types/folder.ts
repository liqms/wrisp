import type { ApiResponse } from '@/shared/types'
import {
  CreateFolderRequest,
  UpdateFolderRequest,
  FolderQueryRequest,
  FolderTreeWithStats,
} from '@/shared/types'
import { Folder } from '@/main/types/db'

export interface FolderAPI {
  create(request: CreateFolderRequest): Promise<ApiResponse<Folder>>
  getInfo(id: number): Promise<ApiResponse<Folder>>
  query(request: FolderQueryRequest): Promise<ApiResponse<Folder[]>>
  getTreeWithStats(parentId: number): Promise<ApiResponse<FolderTreeWithStats[]>>
  update(id: number, request: UpdateFolderRequest): Promise<ApiResponse<number>>
  delete(id: number): Promise<ApiResponse<number>>
  batchMove(ids: number[], newParentId: number | null): Promise<ApiResponse<number>>
}
