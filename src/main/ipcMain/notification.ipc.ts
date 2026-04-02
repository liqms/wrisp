import { ipcMain } from 'electron'
import { notificationInfo, notificationError, notificationSuccess, notificationWarning } from '@/main/core/apis/notification.api'
import type { ApiResponse } from '@/shared/types'
import type { NotificationOptions } from '@/shared/types'

export function registerNotificationHandlers(): void {
  ipcMain.handle('notification:info', async (_, message: string, options?: NotificationOptions): Promise<ApiResponse<void>> => {
    return await notificationInfo(message, options)
  })

  ipcMain.handle('notification:success', async (_, message: string, options?: NotificationOptions): Promise<ApiResponse<void>> => {
    return await notificationSuccess(message, options)
  })

  ipcMain.handle('notification:warning', async (_, message: string, options?: NotificationOptions): Promise<ApiResponse<void>> => {
    return await notificationWarning(message, options)
  })

  ipcMain.handle('notification:error', async (_, message: string, options?: NotificationOptions): Promise<ApiResponse<void>> => {
    return await notificationError(message, options)
  })
}
