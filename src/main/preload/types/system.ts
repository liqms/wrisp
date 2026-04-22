import type { ApiResponse, SystemInfo, NotificationLevel } from '@/shared/types'
import type { OpenDialogOptions, OpenDialogReturnValue } from 'electron'

export interface SystemAPI {
  getSystemInfo(): Promise<ApiResponse<SystemInfo>>
  showSystemNotification(level: NotificationLevel, title: string, body: string): Promise<ApiResponse<void>>
  openDialog(options: OpenDialogOptions): Promise<ApiResponse<OpenDialogReturnValue>>
}