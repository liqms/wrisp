import SystemService from '@/main/core/services/system.service'
import { response } from "@/main/utils/response";
import { ErrorCode } from '@/shared/enums'
import type { ApiResponse, SystemInfo, NotificationLevel } from '@/shared/types'
import type { OpenDialogOptions, OpenDialogReturnValue } from 'electron'
import { Logger } from '@/main/utils/logger'

const systemService = SystemService.getInstance()

async function getSystemInfo(): Promise<ApiResponse<SystemInfo>> {
  try {
    const systemInfo = systemService.getSystemInfo()
    // Logger.debug('系统信息 API 调用成功', { systemInfo: JSON.stringify(systemInfo) })
    return response.success(systemInfo)
  } catch (error) {
    Logger.error('系统信息 API 调用失败', { error: JSON.stringify(error) })
    return response.error(ErrorCode.SYSTEM_GET_INFO_FAILED, error as Error)
  }
}

async function showSystemNotification(level: NotificationLevel, title: string, body: string): Promise<ApiResponse<void>> {
  try {
    systemService.showSystemNotification(level, title, body)
    return response.empty()
  } catch (error) {
    Logger.error('系统通知 API 调用失败', { error: JSON.stringify(error) })
    return response.error(ErrorCode.NOTIFICATION_ADD_ERROR, error as Error)
  }
}

async function openDialog(options: OpenDialogOptions): Promise<ApiResponse<OpenDialogReturnValue>> {
  try {
    const result = await systemService.openDialog(options)
    return response.success(result)
  } catch (error) {
    Logger.error('系统打开对话框 API 调用失败', { error: JSON.stringify(error) })
    return response.error(ErrorCode.SYSTEM_OPEN_DIALOG_ERROR, error as Error)
  }
}

export {
  getSystemInfo,
  showSystemNotification,
  openDialog
}
