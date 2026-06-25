import { Logger } from "@/main/utils/logger";

const PREFIX = "[LLMGateway]";

export class GatewayLogger {
  /** 记录 INFO 级别网关日志 */
  static info(message: string, meta?: Record<string, unknown>): void {
    Logger.info(`${PREFIX} ${message}`, meta);
  }

  /** 记录 WARN 级别网关日志 */
  static warn(message: string, meta?: Record<string, unknown>): void {
    Logger.warn(`${PREFIX} ${message}`, meta);
  }

  /** 记录 ERROR 级别网关日志 */
  static error(message: string, meta?: Record<string, unknown>): void {
    Logger.error(`${PREFIX} ${message}`, meta);
  }

  /** 记录 DEBUG 级别网关日志 */
  static debug(message: string, meta?: Record<string, unknown>): void {
    Logger.debug(`${PREFIX} ${message}`, meta);
  }
}