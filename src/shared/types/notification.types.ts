/**
 * 通知接口层类型定义
 */

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

export interface BaseNotification {
  id: string;
  level: NotificationLevel;
  content: string;
  timestamp: number;
}

export interface NotificationAction {
  label: string;
  handler: string;
  payload?: any;
}

export interface NotificationMessage extends BaseNotification {
  title?: string;
  description?: string;
  meta?: string;
  timeout?: number;
  actions?: NotificationAction[];
}

export interface NotificationOptions extends Partial<Omit<NotificationMessage, 'id' | 'level' | 'content' | 'timestamp'>> { }

export const NOTIFICATION_CHANNEL = 'notification:show';