export enum LOG_LEVEL {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

export const LOG_LEVELS = {
  DEBUG: LOG_LEVEL.DEBUG,
  INFO: LOG_LEVEL.INFO,
  WARN: LOG_LEVEL.WARN,
  ERROR: LOG_LEVEL.ERROR,
} as const;

export enum LOG_FORMAT {
  TEXT = "text",
  JSON = "json",
}

export const LOG_FORMATS = {
  TEXT: LOG_FORMAT.TEXT,
  JSON: LOG_FORMAT.JSON,
} as const;
