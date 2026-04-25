import { ipcMain } from 'electron'
import type { ApiResponse } from '@/shared/types'
import {
  createNovel,
  getNovelInfo,
  queryNovels,
  updateNovel,
  deleteNovel,
  createNovelFile,
  queryNovelFiles,
  getNovelFileContent,
  updateNovelFileContent,
  deleteNovelFile,
  moveFiles
} from '@/main/core/apis/novel.api'
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
  FoldersAndFilesList
} from '@/shared/types'

export function registerNovelHandlers(): void {
  ipcMain.handle('novel:create', async (_, request: CreateNovelRequest): Promise<ApiResponse<NovelBaseInfo>> => {
    return await createNovel(request)
  })

  ipcMain.handle('novel:getInfo', async (_, id: number): Promise<ApiResponse<NovelDetail>> => {
    return await getNovelInfo(id)
  })

  ipcMain.handle('novel:query', async (_, request: QueryNovelRequest): Promise<ApiResponse<NovelBaseInfo[]>> => {
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

  ipcMain.handle('novel:createFile', async (_, request: CreateNovelFileRequest): Promise<ApiResponse<NovelFileInfo>> => {
    return await createNovelFile(request)
  })

  ipcMain.handle('novel:queryFiles', async (_, request: QueryNovelFileRequest): Promise<ApiResponse<FoldersAndFilesList>> => {
    return await queryNovelFiles(request)
  })

  ipcMain.handle('novel:getFileContent', async (_, id: number): Promise<ApiResponse<NovelFileInfo>> => {
    return await getNovelFileContent(id)
  })

  ipcMain.handle('novel:updateFileContent', async (_, id: number, request: UpdateNovelFileRequest): Promise<ApiResponse<NovelFileInfo>> => {
    return await updateNovelFileContent(id, request)
  })

  ipcMain.handle('novel:deleteFile', async (_, id: number): Promise<ApiResponse<boolean>> => {
    return await deleteNovelFile(id)
  })

  ipcMain.handle('novel:moveFiles', async (_, ids: number[], parentId: number): Promise<ApiResponse<number>> => {
    return await moveFiles(ids, parentId)
  })
}