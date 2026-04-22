import { BrowserWindow } from 'electron';
import { NotificationMessage, NotificationLevel, NOTIFICATION_CHANNEL, NotificationOptions } from '@/shared/types/notification.types';
import { NodeCryptoUtil } from '@/main/utils/crypto';

/**
 * 通知服务
 * 提供应用内通知功能，向渲染进程发送不同级别的通知消息
 * 支持信息、成功、警告、错误四种通知级别
 */
export class NotificationService {
  private static instance: NotificationService | null = null

  /**
   * 私有构造函数
   * 防止外部实例化
   */
  private constructor() {
    // 私有构造函数
  }

  /**
   * 获取 NotificationService 的单例实例
   * @returns NotificationService 单例实例
   */
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  /**
   * 向渲染进程发送通知
   * 通过 IPC 向指定窗口或所有窗口发送通知消息
   * @param window - 目标窗口，为 null 时发送给所有窗口
   * @param level - 通知级别（info、success、warning、error）
   * @param content - 通知消息内容
   * @param options - 通知选项，可选
   * @returns 完整的通知消息对象
   */
  public sendToRenderer(
    window: BrowserWindow | null,
    level: NotificationLevel,
    content: string,
    options?: Partial<Omit<NotificationMessage, 'id' | 'level' | 'content' | 'timestamp'>>
  ) {
    const notification: NotificationMessage = {
      id: NodeCryptoUtil.generateUUID(),
      level,
      content,
      timestamp: Date.now(),
      ...options,
    };

    const targetWindows = window ? [window] : BrowserWindow.getAllWindows();
    targetWindows.forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(NOTIFICATION_CHANNEL, notification);
      }
    });

    return notification;
  }

  /**
   * 发送信息级别的通知
   * 向所有窗口发送信息级别的通知
   * @param message - 通知消息内容
   * @param options - 通知选项，可选
   * @returns 通知消息对象
   */
  public info(message: string, options?: NotificationOptions) {
    return this.sendToRenderer(null, 'info', message, options);
  }

  /**
   * 发送成功级别的通知
   * 向所有窗口发送成功级别的通知
   * @param message - 通知消息内容
   * @param options - 通知选项，可选
   * @returns 通知消息对象
   */
  public success(message: string, options?: NotificationOptions) {
    return this.sendToRenderer(null, 'success', message, options);
  }

  /**
   * 发送警告级别的通知
   * 向所有窗口发送警告级别的通知
   * @param message - 通知消息内容
   * @param options - 通知选项，可选
   * @returns 通知消息对象
   */
  public warning(message: string, options?: NotificationOptions) {
    return this.sendToRenderer(null, 'warning', message, options);
  }

  /**
   * 发送错误级别的通知
   * 向所有窗口发送错误级别的通知
   * @param message - 通知消息内容
   * @param options - 通知选项，可选
   * @returns 通知消息对象
   */
  public error(message: string, options?: NotificationOptions) {
    return this.sendToRenderer(null, 'error', message, options);
  }
}

// 导出单例实例
export const notificationService = NotificationService.getInstance()