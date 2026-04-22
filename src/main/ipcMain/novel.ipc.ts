import { ipcMain } from 'electron'
import type { ApiResponse } from '@/shared/types'
import {
  createNovel,
  getNovelInfo,
  queryNovels,
  updateNovel,
  deleteNovel,
  createChapter,
  queryChapters,
  getChapterContent,
  updateChapterContent,
  deleteChapter
} from '@/main/core/apis/novel.api'
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

export function registerNovelHandlers(): void {
  ipcMain.handle('novel:create', async (_, request: CreateNovelRequest): Promise<ApiResponse<NovelBaseInfo>> => {
    return await createNovel(request)
  })

  ipcMain.handle('novel:getInfo', async (_, id: number): Promise<ApiResponse<NovelDetail>> => {
    return await getNovelInfo(id)
  })

  ipcMain.handle('novel:query', async (_, request: NovelQueryRequest): Promise<ApiResponse<NovelBaseInfo[]>> => {
    return await queryNovels(request)
  })

  ipcMain.handle('novel:update', async (_, id: number, request: UpdateNovelRequest): Promise<ApiResponse<boolean>> => {
    return await updateNovel(id, request)
  })

  ipcMain.handle('novel:delete', async (_, id: number): Promise<ApiResponse<{
    worksDeleted: number
    foldersDeleted: number
    filesDeleted: number
    worksTagsDeleted: number
    fileVersionsDeleted: number
  }>> => {
    return await deleteNovel(id)
  })

  ipcMain.handle('novel:createChapter', async (_, request: CreateChapterRequest): Promise<ApiResponse<NovelChapterInfo>> => {
    return await createChapter(request)
  })

  ipcMain.handle('novel:queryChapters', async (_, request: ChapterQueryRequest): Promise<ApiResponse<FolderAndFileList>> => {
    return await queryChapters(request)
  })

  ipcMain.handle('novel:getChapterContent', async (_, id: number): Promise<ApiResponse<NovelChapterInfo>> => {
    return await getChapterContent(id)
  })

  ipcMain.handle('novel:updateChapterContent', async (_, id: number, request: UpdateChapterRequest): Promise<ApiResponse<boolean>> => {
    return await updateChapterContent(id, request)
  })

  ipcMain.handle('novel:deleteChapter', async (_, id: number): Promise<ApiResponse<boolean>> => {
    return await deleteChapter(id)
  })
}