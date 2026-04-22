import type { ApiResponse } from '@/shared/types'
import {
  CreateNovelRequest,
  UpdateNovelRequest,
  NovelQueryRequest,
  NovelBaseInfo,
  NovelDetail,
  CreateChapterRequest,
  NovelChapterInfo,
  UpdateChapterRequest,
  ChapterQueryRequest,
  FolderAndFileList
} from '@/shared/types'

export interface NovelAPI {
  create(request: CreateNovelRequest): Promise<ApiResponse<NovelBaseInfo>>
  getInfo(id: number): Promise<ApiResponse<NovelDetail>>
  query(request: NovelQueryRequest): Promise<ApiResponse<NovelBaseInfo[]>>
  update(id: number, request: UpdateNovelRequest): Promise<ApiResponse<boolean>>
  delete(id: number): Promise<ApiResponse<{
    worksDeleted: number
    foldersDeleted: number
    filesDeleted: number
    worksTagsDeleted: number
    fileVersionsDeleted: number
  }>>
  createChapter(request: CreateChapterRequest): Promise<ApiResponse<NovelChapterInfo>>
  queryChapters(request: ChapterQueryRequest): Promise<ApiResponse<FolderAndFileList>>
  getChapterContent(id: number): Promise<ApiResponse<NovelChapterInfo>>
  updateChapterContent(id: number, request: UpdateChapterRequest): Promise<ApiResponse<boolean>>
  deleteChapter(id: number): Promise<ApiResponse<boolean>>
}