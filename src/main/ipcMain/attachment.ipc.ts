import { ipcMain } from 'electron'
import { importImage } from '@/main/core/apis/attachment.api'
import type { ApiResponse, ImportedImage } from '@/shared/types'

export function registerAttachmentHandlers(): void {
  ipcMain.handle('attachment:importImage', async (): Promise<ApiResponse<ImportedImage | null>> => {
    return await importImage()
  })
}
