import { ipcMain } from 'electron'
import type { ApiResponse } from '@/shared/types'
import {
  createFolder,
  getFolderInfo,
  queryFolders,
  getTreeWithStats,
  updateFolder,
  deleteFolder,
  batchMoveFolders,
} from '@/main/core/apis/folder.api'
import {
  CreateFolderRequest,
  UpdateFolderRequest,
  FolderQueryRequest,
  FolderTreeWithStats,
} from '@/shared/types'
import { Folder } from '@/main/types/db'

export function registerFolderHandlers(): void {
  ipcMain.handle('folder:create', async (_, request: CreateFolderRequest): Promise<ApiResponse<Folder>> => {
    return await createFolder(request)
  })

  ipcMain.handle('folder:getInfo', async (_, id: number): Promise<ApiResponse<Folder>> => {
    return await getFolderInfo(id)
  })

  ipcMain.handle('folder:query', async (_, request: FolderQueryRequest): Promise<ApiResponse<Folder[]>> => {
    return await queryFolders(request)
  })

  ipcMain.handle('folder:getTreeWithStats', async (_, parentId: number): Promise<ApiResponse<FolderTreeWithStats[]>> => {
    return await getTreeWithStats(parentId)
  })

  ipcMain.handle('folder:update', async (_, id: number, request: UpdateFolderRequest): Promise<ApiResponse<number>> => {
    return await updateFolder(id, request)
  })

  ipcMain.handle('folder:delete', async (_, id: number): Promise<ApiResponse<number>> => {
    return await deleteFolder(id)
  })


  ipcMain.handle('folder:batchMove', async (_, ids: number[], newParentId: number | null): Promise<ApiResponse<number>> => {
    return await batchMoveFolders(ids, newParentId)
  })

}
