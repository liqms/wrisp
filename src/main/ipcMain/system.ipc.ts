import { ipcMain } from 'electron'
import { getSystemInfo, showSystemNotification, openDialog } from '@/main/core/apis/system.api'
import type { SystemInfo } from '@/shared/types'
import type { ApiResponse } from '@/shared/types'
import type { OpenDialogOptions, OpenDialogReturnValue } from 'electron'

export function registerSystemHandlers(): void {
  ipcMain.handle('system:getSystemInfo', async (): Promise<ApiResponse<SystemInfo>> => {
    return await getSystemInfo()
  })

  ipcMain.handle('system:showSystemNotification', async (_, title: string, body: string): Promise<ApiResponse<void>> => {
    return await showSystemNotification(title, body)
  })

  ipcMain.handle('system:openDialog', async (_, options: OpenDialogOptions): Promise<ApiResponse<OpenDialogReturnValue>> => {
    return await openDialog(options)
  })
}
