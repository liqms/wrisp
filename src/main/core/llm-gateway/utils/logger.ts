import { Logger } from "@/main/utils/logger";

const PREFIX = "[LLMGateway]";

export class GatewayLogger {
  static info(message: string, meta?: Record<string, unknown>): void {
    Logger.info(`${PREFIX} ${message}`, meta);
  }

  static warn(message: string, meta?: Record<string, unknown>): void {
    Logger.warn(`${PREFIX} ${message}`, meta);
  }

  static error(message: string, meta?: Record<string, unknown>): void {
    Logger.error(`${PREFIX} ${message}`, meta);
  }

  static debug(message: string, meta?: Record<string, unknown>): void {
    Logger.debug(`${PREFIX} ${message}`, meta);
  }
}