import SystemService from '@/main/core/services/system.service'
import { response } from "@/main/utils/response";
import { ErrorCode } from '@/shared/enums'
import type { ApiResponse, SystemInfo } from '@/shared/types'
import type { OpenDialogOptions, OpenDialogReturnValue } from 'electron'

const systemService = SystemService.getInstance()

async function getSystemInfo(): Promise<ApiResponse<SystemInfo>> {
  try {
    const systemInfo = systemService.getSystemInfo()
    return response.success(systemInfo)
  } catch (error) {
    return response.error(ErrorCode.SYSTEM_INFO_ERROR, error as Error)
  }
}

async function showSystemNotification(title: string, body: string): Promise<ApiResponse<void>> {
  try {
    systemService.showSystemNotification(title, body)
    return response.empty()
  } catch (error) {
    return response.error(ErrorCode.SYSTEM_NOTIFICATION_ERROR, error as Error)
  }
}

async function openDialog(options: OpenDialogOptions): Promise<ApiResponse<OpenDialogReturnValue>> {
  try {
    const result = await systemService.openDialog(options)
    return response.success(result)
  } catch (error) {
    return response.error(ErrorCode.OPEN_DIALOG_ERROR, error as Error)
  }
}

export {
  getSystemInfo,
  showSystemNotification,
  openDialog
}
