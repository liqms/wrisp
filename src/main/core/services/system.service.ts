import { app, Notification, OpenDialogOptions, OpenDialogReturnValue, dialog } from 'electron'
import os from 'os'
import { Logger } from '@/main/utils/logger'
import { SystemInfo } from '@/shared/types'

/**
 * 系统服务 - 提供系统级功能调用
 * 注意：此类服务处理操作系统级别的功能，不同于应用内通信
 * 用途：系统信息获取、系统通知、文件对话框等
 */
class SystemService {
  private static instance: SystemService

  private constructor() { }

  public static getInstance(): SystemService {
    if (!SystemService.instance) {
      SystemService.instance = new SystemService()
    }
    return SystemService.instance
  }

  /**
   * 获取系统信息
   */
  public getSystemInfo(): SystemInfo {
    try {
      const systemInfo: SystemInfo = {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.versions.node,
        electronVersion: process.versions.electron,
        appVersion: app.getVersion(),
        hostname: os.hostname(),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        cpus: os.cpus().length
      }
      return systemInfo
    } catch (error) {
      Logger.error('获取系统信息失败', { error })
      return {
        platform: 'unknown',
        arch: 'unknown',
        nodeVersion: 'unknown',
        electronVersion: 'unknown',
        appVersion: 'unknown',
        hostname: 'unknown',
        totalMemory: 0,
        freeMemory: 0,
        cpus: 0
      }
    }
  }

  /**
   * 显示系统级桌面通知
   * 注意：此类通知是操作系统级别的，不同于应用内通知
   * 用途：系统级提醒、后台任务完成通知等
   */
  public showSystemNotification(title: string, body: string): void {
    try {
      if (Notification.isSupported()) {
        const notification = new Notification({ title, body })
        notification.show()
        Logger.info(`系统通知显示成功: ${title}`)
      } else {
        Logger.warn('系统不支持通知功能')
      }
    } catch (error) {
      Logger.error('显示系统通知失败', { error })
    }
  }

  /**
   * 打开文件对话框
   */
  public async openDialog(options: OpenDialogOptions): Promise<OpenDialogReturnValue> {
    try {
      Logger.debug('打开对话框', { options: JSON.stringify(options) })
      const result = await dialog.showOpenDialog(options)
      Logger.debug('对话框结果', { result: JSON.stringify(result) })
      return result
    } catch (error) {
      Logger.error('打开对话框失败', { error })
      throw error
    }
  }
}

export default SystemService

export const systemService = SystemService.getInstance()
