import { ipcMain } from 'electron'
import type { ApiResponse } from '@/shared/types'
import {
  batchMoveFiles,
} from '@/main/core/apis/file.api'

export function registerFileHandlers(): void {
  ipcMain.handle('file:move', async (_, request: { ids: number[], newFolderId: number }): Promise<ApiResponse<number>> => {
    return await batchMoveFiles(request.ids, request.newFolderId)
  })
}
