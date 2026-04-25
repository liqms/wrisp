import type { ApiResponse } from '@/shared/types'
import {
  CreateNovelRequest,
  UpdateNovelRequest,
  QueryNovelRequest,
  NovelBaseInfo,
  NovelDetail,
  CreateNovelFileRequest,
  NovelFileInfo,
  UpdateNovelFileRequest,
  QueryNovelFileRequest,
  FolderAndFileList
} from '@/shared/types'

export interface NovelAPI {
  create(request: CreateNovelRequest): Promise<ApiResponse<NovelBaseInfo>>
  getInfo(id: number): Promise<ApiResponse<NovelDetail>>
  query(request: QueryNovelRequest): Promise<ApiResponse<NovelBaseInfo[]>>
  update(id: number, request: UpdateNovelRequest): Promise<ApiResponse<boolean>>
  delete(id: number): Promise<ApiResponse<{
    worksDeleted: number
    foldersDeleted: number
    filesDeleted: number
    worksTagsDeleted: number
    fileVersionsDeleted: number
  }>>
  createFile(request: CreateNovelFileRequest): Promise<ApiResponse<NovelFileInfo>>
  queryFiles(request: QueryNovelFileRequest): Promise<ApiResponse<FolderAndFileList>>
  getFileContent(id: number): Promise<ApiResponse<NovelFileInfo>>
  updateFileContent(id: number, request: UpdateNovelFileRequest): Promise<ApiResponse<NovelFileInfo>>
  deleteFile(id: number): Promise<ApiResponse<boolean>>
  moveFiles(ids: number[], parentId: number): Promise<ApiResponse<number>>
}