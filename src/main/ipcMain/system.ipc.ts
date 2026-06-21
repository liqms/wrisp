import { ipcMain } from 'electron'
import { getSystemInfo, showSystemNotification, openDialog, openExternal } from '@/main/core/apis/system.api'
import type { SystemInfo, NotificationLevel,ApiResponse } from '@/shared/types'
import type { OpenDialogOptions, OpenDialogReturnValue } from 'electron'

export function registerSystemHandlers(): void {
  ipcMain.handle('system:getSystemInfo', async (): Promise<ApiResponse<SystemInfo>> => {
    return await getSystemInfo()
  })

  ipcMain.handle('system:showSystemNotification', async (_, level: NotificationLevel, title: string, body: string): Promise<ApiResponse<void>> => {
    return await showSystemNotification(level, title, body)
  })

  ipcMain.handle('system:openDialog', async (_, options: OpenDialogOptions): Promise<ApiResponse<OpenDialogReturnValue>> => {
    return await openDialog(options)
  })

  ipcMain.handle('system:openExternal', async (_, url: string): Promise<ApiResponse<void>> => {
    return await openExternal(url)
  })
}
