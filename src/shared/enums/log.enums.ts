export enum LogLevelEnum {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export const LOG_LEVELS = {
  DEBUG: LogLevelEnum.DEBUG,
  INFO: LogLevelEnum.INFO,
  WARN: LogLevelEnum.WARN,
  ERROR: LogLevelEnum.ERROR
} as const

export enum LogFormatEnum {
  TEXT = 'text',
  JSON = 'json'
}

export const LOG_FORMATS = {
  TEXT: LogFormatEnum.TEXT,
  JSON: LogFormatEnum.JSON
} as const