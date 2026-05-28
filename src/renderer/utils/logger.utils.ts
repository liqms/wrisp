/**
 * 前端日志适配器实现
 */
import { LOG_LEVEL } from "@/shared/enums";
import type { LogContext } from "@/main/utils/logger";
export class Logger {
  /**
   * 记录错误日志
   * @param message 错误消息
   * @param context 日志上下文
   */
  error(message: string, context?: LogContext): void {
    window.electronAPI.logger.error(message, context);
  }

  /**
   * 记录警告日志
   * @param message 警告消息
   * @param context 日志上下文
   */
  warn(message: string, context?: LogContext): void {
    window.electronAPI.logger.warn(message, context);
  }
  log(level: LOG_LEVEL, message: string, context?: LogContext): void {
    window.electronAPI.logger.log(level, message, context);
  }

  /**
   * 记录信息日志
   * @param message 信息消息
   * @param context 日志上下文
   */
  info(message: string, context?: LogContext): void {
    window.electronAPI.logger.info(message, context);
  }

  /**
   * 记录调试日志
   * @param message 调试消息
   * @param context 日志上下文
   */
  debug(message: string, context?: LogContext): void {
    window.electronAPI.logger.debug(message, context);
  }
}

/**
 * 创建前端日志适配器实例
 * @returns 日志适配器实例
 */
export function createLogger(): Logger {
  return new Logger();
}

/**
 * 默认的前端日志适配器实例
 */
export const logger = createLogger();
