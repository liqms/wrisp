import { app } from "electron";
import * as winston from "winston";
import * as path from "path";
import * as fs from "fs";
import {
  LOG_LEVEL,
  LOG_FORMAT,
  LOG_LEVELS,
  LOG_FORMATS,
} from "@/shared/enums/log.enums";

// 常量定义
const TIMESTAMP_FORMAT = "YYYY-MM-DD HH:mm:ss";
const DATE_FORMAT = "YYYY-MM-DD";
const DEFAULT_KEEP_DAYS = 30; // 默认保留30天日志
const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO; // 日志级别，默认info
const DEFAULT_LOG_DIR = "logs"; // 日志目录，默认logs
const DEFAULT_LOG_MAX_SIZE = "10m"; // 日志文件最大大小，默认10m
const DEFAULT_LOG_MAX_FILES = 5; // 日志文件最大数量，默认5
const DEFAULT_LOG_FORMAT = LOG_FORMATS.TEXT; // 日志格式，默认text
const DEFAULT_LOG_CONSOLE = true; // 控制台输出日志，非生产环境默认启用，生产环境禁用
const DEFAULT_LOG_FILE = true; // 文件输出日志，默认启用
const DEFAULT_LOG_TIMESTAMP = true; // 日志包含时间戳，默认启用
const DEFAULT_LOG_COLORIZE = true; // 控制台日志彩色输出，默认启用
const DEFAULT_LOG_SPLIT_BY_DATE = true; // 日志按日期分割，默认启用

const SIZE_UNITS: Record<string, number> = {
  b: 1,
  k: 1024,
  m: 1024 * 1024,
  g: 1024 * 1024 * 1024,
} as const;

// 日志文件前缀
const LOG_FILE_PREFIXES = {
  error: "error",
  warn: "warn",
  info: "info",
  debug: "debug",
} as const;

const LOG_LEVEL_DIRS: Record<string, string> = {
  error: "error",
  warn: "warn",
  info: "info",
  debug: "debug",
} as const;

export interface LoggerConfig {
  level?: LOG_LEVEL;
  console?: boolean;
  file?: boolean;
  maxSize?: string;
  maxFiles?: number;
  format?: LOG_FORMAT;
  timestamp?: boolean;
  colorize?: boolean;
  splitByDate?: boolean;
  dateFormat?: string;
  keepDays?: number;
}

export type LogContext = Record<string, unknown>;

export class Logger {
  private static instance: winston.Logger | null = null;

  private static config: Required<LoggerConfig> = {
    level: DEFAULT_LOG_LEVEL,
    console: DEFAULT_LOG_CONSOLE,
    file: DEFAULT_LOG_FILE,
    maxSize: DEFAULT_LOG_MAX_SIZE,
    maxFiles: DEFAULT_LOG_MAX_FILES,
    format: DEFAULT_LOG_FORMAT,
    timestamp: DEFAULT_LOG_TIMESTAMP,
    colorize: DEFAULT_LOG_COLORIZE,
    splitByDate: DEFAULT_LOG_SPLIT_BY_DATE,
    dateFormat: DATE_FORMAT,
    keepDays: DEFAULT_KEEP_DAYS,
  };

  static initialize(config?: Partial<LoggerConfig>): void {
    if (this.instance) {
      return;
    }

    try {
      // 调试：输出原始环境变量
      console.log(
        `[Logger] 原始 LOG_LEVEL 环境变量: '${process.env.LOG_LEVEL}'`,
      );

      this.loadConfigFromEnv();

      // 调试：输出加载后的配置
      console.log(`[Logger] 加载配置后日志级别: '${this.config.level}'`);

      this.config = { ...this.config, ...config };
      this.validateConfig();

      const transports: winston.transport[] = [];
      const baseFormat = this.createBaseFormat();

      // 控制台传输
      if (this.config.console) {
        const consoleFormats: winston.Logform.Format[] = [];

        if (this.config.timestamp) {
          consoleFormats.push(
            winston.format.timestamp({ format: TIMESTAMP_FORMAT }),
          );
        }

        if (this.config.colorize) {
          consoleFormats.push(winston.format.colorize());
        }

        consoleFormats.push(baseFormat);

        transports.push(
          new winston.transports.Console({
            format: winston.format.combine(...consoleFormats),
            handleExceptions: true,
            handleRejections: true,
            stderrLevels: ["error"],
            consoleWarnLevels: ["warn"],
            // 确保控制台输出使用正确的编码
            level: this.config.level,
          }),
        );
      }

      // 文件传输
      if (this.config.file) {
        const maxSize = this.parseSize(this.config.maxSize);
        const logRootDir = this.getLogDir();

        // 按日期分割或按级别分文件
        if (this.config.splitByDate) {
          // 按日期分割：每个级别一个文件，按日期滚动
          const levels = [
            LOG_LEVELS.ERROR,
            LOG_LEVELS.WARN,
            LOG_LEVELS.INFO,
            LOG_LEVELS.DEBUG,
          ];

          levels.forEach((level) => {
            const filename = this.getDateBasedFilename(level);
            const levelDir = path.join(
              logRootDir,
              LOG_LEVEL_DIRS[level] || "app",
            );
            fs.mkdirSync(levelDir, { recursive: true });
            transports.push(
              new winston.transports.File({
                filename: path.join(logRootDir, filename),
                level: level,
                maxsize: maxSize,
                maxFiles: this.config.keepDays,
                format: winston.format.combine(
                  this.levelFilter(level),
                  winston.format.timestamp({ format: TIMESTAMP_FORMAT }),
                  winston.format.errors({ stack: true }),
                  baseFormat,
                ),
              }),
            );
          });
        } else {
          // 按级别分文件：每个级别一个固定文件
          const levels = [
            LOG_LEVELS.ERROR,
            LOG_LEVELS.WARN,
            LOG_LEVELS.INFO,
            LOG_LEVELS.DEBUG,
          ];

          levels.forEach((level) => {
            const dirName = LOG_LEVEL_DIRS[level] || "app";
            const levelDir = path.join(logRootDir, dirName);
            fs.mkdirSync(levelDir, { recursive: true });
            const prefix =
              LOG_FILE_PREFIXES[level as keyof typeof LOG_FILE_PREFIXES] ||
              "app";
            const filename = path.join(dirName, `${prefix}.log`);
            transports.push(
              new winston.transports.File({
                filename: path.join(logRootDir, filename),
                level: level,
                maxsize: maxSize,
                maxFiles: this.config.maxFiles,
                format: winston.format.combine(
                  this.levelFilter(level),
                  winston.format.timestamp({ format: TIMESTAMP_FORMAT }),
                  winston.format.errors({ stack: true }),
                  baseFormat,
                ),
              }),
            );
          });
        }
      }

      this.instance = winston.createLogger({
        level: this.config.level,
        transports,
      });
    } catch (error) {
      console.error("Logger初始化失败, 使用默认配置", error);
      this.initializeWithDefaults();
    }
  }

  private static initializeWithDefaults(): void {
    if (this.instance) {
      return;
    }

    this.loadConfigFromEnv();

    const logRootDir = this.getLogDir();
    const baseFormat = this.createBaseFormat();

    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp({ format: TIMESTAMP_FORMAT }),
          winston.format.colorize(),
          baseFormat,
        ),
        handleExceptions: true,
        handleRejections: true,
        level: this.config.level,
      }),
    ];

    const maxSize = this.parseSize(this.config.maxSize);
    const levels = [
      LOG_LEVELS.ERROR,
      LOG_LEVELS.WARN,
      LOG_LEVELS.INFO,
      LOG_LEVELS.DEBUG,
    ];

    levels.forEach((level) => {
      const filename = this.getDateBasedFilename(level);
      const levelDir = path.join(logRootDir, LOG_LEVEL_DIRS[level] || "app");
      fs.mkdirSync(levelDir, { recursive: true });
      transports.push(
        new winston.transports.File({
          filename: path.join(logRootDir, filename),
          level: level,
          maxsize: maxSize,
          maxFiles: this.config.keepDays,
          format: winston.format.combine(
            this.levelFilter(level),
            winston.format.timestamp({ format: TIMESTAMP_FORMAT }),
            winston.format.errors({ stack: true }),
            baseFormat,
          ),
        }),
      );
    });

    this.instance = winston.createLogger({
      level: this.config.level,
      transports,
    });
  }

  private static loadConfigFromEnv(): void {
    // 如果环境变量还没加载，尝试重新加载 dotenv
    if (!process.env.LOG_LEVEL) {
      try {
        const dotenv = require("dotenv");
        dotenv.config({ encoding: "utf8", override: true });
      } catch (e) {
        console.warn("[Logger] 无法加载 dotenv:", e);
      }
    }

    // 简化配置读取，支持大小写不敏感
    const rawLogLevel = process.env.LOG_LEVEL;
    const logLevel = rawLogLevel
      ? (rawLogLevel.toLowerCase() as LOG_LEVEL)
      : undefined;
    if (logLevel && Object.values(LOG_LEVEL).includes(logLevel)) {
      this.config.level = logLevel;
    }

    this.config.console = process.env.LOG_CONSOLE !== "false";
    this.config.file = process.env.LOG_FILE !== "false";
    this.config.maxSize = process.env.LOG_MAX_SIZE || "10m";

    const maxFiles = parseInt(process.env.LOG_MAX_FILES || "5");
    this.config.maxFiles = maxFiles > 0 ? maxFiles : 5;

    this.config.timestamp = process.env.LOG_TIMESTAMP !== "false";
    this.config.colorize = process.env.LOG_COLORIZE !== "false";
    this.config.splitByDate = process.env.LOG_SPLIT_BY_DATE !== "false";

    const keepDays = parseInt(
      process.env.LOG_KEEP_DAYS || DEFAULT_KEEP_DAYS.toString(),
    );
    this.config.keepDays = keepDays > 0 ? keepDays : DEFAULT_KEEP_DAYS;
  }

  private static validateConfig(): void {
    if (this.config.maxFiles < 1) {
      this.config.maxFiles = 5;
    }

    if (
      !this.config.maxSize ||
      !/^(\d+)([bkmg]?)$/i.test(this.config.maxSize)
    ) {
      this.config.maxSize = "10m";
    }
  }

  private static createBaseFormat(): winston.Logform.Format {
    return this.config.format === "json"
      ? winston.format.json()
      : winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr =
            Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        });
  }

  private static levelFilter(level: string): winston.Logform.Format {
    return winston.format((info) => {
      if (info.level === level || info.level === level.toLowerCase()) {
        return info;
      }
      return false;
    })();
  }

  private static getLogDir(level?: string): string {
    let logDir: string;
    try {
      logDir = app.getPath(DEFAULT_LOG_DIR);
    } catch {
      logDir = process.env.LOG_DIR || path.join(process.cwd(), DEFAULT_LOG_DIR);
    }

    if (level && LOG_LEVEL_DIRS[level]) {
      logDir = path.join(logDir, LOG_LEVEL_DIRS[level]);
    }

    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch {
      logDir = path.join(process.cwd(), DEFAULT_LOG_DIR);
      if (level && LOG_LEVEL_DIRS[level]) {
        logDir = path.join(logDir, LOG_LEVEL_DIRS[level]);
      }
      fs.mkdirSync(logDir, { recursive: true });
    }

    return logDir;
  }

  private static parseSize(size: string): number {
    const match = size.toLowerCase().match(/^(\d+)([bkmg]?)$/);
    if (!match) {
      return 10 * 1024 * 1024;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2] || "b";
    return value * (SIZE_UNITS[unit] || 1);
  }

  /**
   * 生成基于日期的文件名
   * @param level 日志级别
   * @returns 文件名
   */
  private static getDateBasedFilename(level: string): string {
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const prefix =
      LOG_FILE_PREFIXES[level as keyof typeof LOG_FILE_PREFIXES] || "app";
    const dirName = LOG_LEVEL_DIRS[level] || "app";
    return path.join(dirName, `${prefix}-${dateStr}.log`);
  }

  private static getInstance(): winston.Logger {
    if (!this.instance) {
      this.initialize();
    }
    return this.instance!;
  }

  static error(message: string, context?: LogContext): void {
    this.getInstance().error(message, context);
  }

  static warn(message: string, context?: LogContext): void {
    this.getInstance().warn(message, context);
  }

  static info(message: string, context?: LogContext): void {
    this.getInstance().info(message, context);
  }

  static debug(message: string, context?: LogContext): void {
    this.getInstance().debug(message, context);
  }

  static log(level: LOG_LEVEL, message: string, context?: LogContext): void {
    const logger = this.getInstance();
    switch (level) {
      case LOG_LEVEL.ERROR:
        logger.error(message, context);
        break;
      case LOG_LEVEL.WARN:
        logger.warn(message, context);
        break;
      case LOG_LEVEL.INFO:
        logger.info(message, context);
        break;
      case LOG_LEVEL.DEBUG:
        logger.debug(message, context);
        break;
      default:
        logger.info(message, context);
    }
  }

  static setLevel(level: LOG_LEVEL): void {
    this.config.level = level;
    this.getInstance().level = level;
  }

  static getLevel(): LOG_LEVEL {
    return this.config.level;
  }

  static isLevelEnabled(level: LOG_LEVEL): boolean {
    const levels = [
      LOG_LEVEL.DEBUG,
      LOG_LEVEL.INFO,
      LOG_LEVEL.WARN,
      LOG_LEVEL.ERROR,
    ];
    return levels.indexOf(level) <= levels.indexOf(this.config.level);
  }

  static createChild(meta: LogContext): winston.Logger {
    return this.getInstance().child(meta);
  }

  static logHttpRequest(
    method: string,
    url: string,
    status: number,
    duration: number,
    context?: LogContext,
  ): void {
    const level = status >= 400 ? LOG_LEVELS.WARN : LOG_LEVELS.INFO;
    this.log(level, "HTTP 请求", {
      method,
      url,
      status,
      duration: `${duration}ms`,
      ...context,
    });
  }

  static logDbQuery(action: string, context?: LogContext): void {
    this.debug("数据库查询", { action, ...context });
  }

  static logAiRequest(
    model: string,
    prompt: string,
    duration: number,
    tokens?: { input: number; output: number },
    context?: LogContext,
  ): void {
    this.info("AI 请求", {
      model,
      promptLength: prompt.length,
      duration: `${duration}ms`,
      tokens,
      ...context,
    });
  }

  static logPerformance(
    operation: string,
    duration: number,
    context?: LogContext,
  ): void {
    const level = duration > 1000 ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG;
    this.log(level, "性能", {
      operation,
      duration: `${duration}ms`,
      ...context,
    });
  }

  static getLogFiles(): string[] {
    const logDir = this.getLogDir();
    if (!fs.existsSync(logDir)) {
      return [];
    }

    const files: string[] = [];
    const levels = Object.values(LOG_LEVEL_DIRS);

    levels.forEach((levelDir) => {
      const levelPath = path.join(logDir, levelDir);
      if (fs.existsSync(levelPath)) {
        const levelFiles = fs
          .readdirSync(levelPath)
          .filter((file) => file.endsWith(".log"))
          .map((file) => path.join(levelDir, file));
        files.push(...levelFiles);
      }
    });

    return files;
  }

  static readLogFile(fileName: string): string {
    const filePath = path.join(this.getLogDir(), fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`日志文件未找到: ${fileName}`);
    }
    return fs.readFileSync(filePath, "utf-8");
  }

  static async readLogFileAsync(fileName: string): Promise<string> {
    const filePath = path.join(this.getLogDir(), fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`日志文件未找到: ${fileName}`);
    }
    return fs.promises.readFile(filePath, "utf-8");
  }

  static clearLogs(): void {
    const logDir = this.getLogDir();
    if (!fs.existsSync(logDir)) {
      return;
    }

    const levels = Object.values(LOG_LEVEL_DIRS);
    levels.forEach((levelDir) => {
      const levelPath = path.join(logDir, levelDir);
      if (fs.existsSync(levelPath)) {
        fs.readdirSync(levelPath)
          .filter((file) => file.endsWith(".log"))
          .forEach((file) => fs.unlinkSync(path.join(levelPath, file)));
      }
    });
  }

  static async clearLogsAsync(): Promise<void> {
    const logDir = this.getLogDir();
    if (!fs.existsSync(logDir)) {
      return;
    }

    const levels = Object.values(LOG_LEVEL_DIRS);
    await Promise.all(
      levels.map(async (levelDir) => {
        const levelPath = path.join(logDir, levelDir);
        if (fs.existsSync(levelPath)) {
          const files = await fs.promises.readdir(levelPath);
          await Promise.all(
            files
              .filter((file) => file.endsWith(".log"))
              .map((file) => fs.promises.unlink(path.join(levelPath, file))),
          );
        }
      }),
    );
  }

  static getLogStats(): {
    totalFiles: number;
    totalSize: number;
    files: Array<{ name: string; size: number; modified: Date; level: string }>;
  } {
    const logDir = this.getLogDir();
    if (!fs.existsSync(logDir)) {
      return { totalFiles: 0, totalSize: 0, files: [] };
    }

    const files: Array<{
      name: string;
      size: number;
      modified: Date;
      level: string;
    }> = [];
    const levels = Object.values(LOG_LEVEL_DIRS);

    levels.forEach((levelDir) => {
      const levelPath = path.join(logDir, levelDir);
      if (fs.existsSync(levelPath)) {
        const levelFiles = fs
          .readdirSync(levelPath)
          .filter((file) => file.endsWith(".log"))
          .map((file) => {
            const filePath = path.join(levelPath, file);
            const stats = fs.statSync(filePath);
            return {
              name: path.join(levelDir, file),
              size: stats.size,
              modified: stats.mtime,
              level: levelDir,
            };
          });
        files.push(...levelFiles);
      }
    });

    return {
      totalFiles: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      files,
    };
  }

  static cleanupOldLogs(keepDays: number = DEFAULT_KEEP_DAYS): number {
    const logDir = this.getLogDir();
    if (!fs.existsSync(logDir)) {
      return 0;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);

    let deletedCount = 0;
    const levels = Object.values(LOG_LEVEL_DIRS);

    levels.forEach((levelDir) => {
      const levelPath = path.join(logDir, levelDir);
      if (!fs.existsSync(levelPath)) {
        return;
      }

      const files = fs
        .readdirSync(levelPath)
        .filter((file) => file.endsWith(".log"));

      files.forEach((file) => {
        const filePath = path.join(levelPath, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime < cutoffDate) {
          try {
            fs.unlinkSync(filePath);
            deletedCount++;
            this.debug(`删除过期日志文件: ${path.join(levelDir, file)}`);
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            this.error(`删除过期日志文件失败: ${path.join(levelDir, file)}`, {
              error: errorMessage,
            });
          }
        }
      });
    });

    return deletedCount;
  }

  static async cleanupOldLogsAsync(
    keepDays: number = DEFAULT_KEEP_DAYS,
  ): Promise<number> {
    const logDir = this.getLogDir();
    if (!fs.existsSync(logDir)) {
      return 0;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);

    let deletedCount = 0;
    const levels = Object.values(LOG_LEVEL_DIRS);

    await Promise.all(
      levels.map(async (levelDir) => {
        const levelPath = path.join(logDir, levelDir);
        if (!fs.existsSync(levelPath)) {
          return;
        }

        const files = await fs.promises.readdir(levelPath);
        const logFiles = files.filter((file) => file.endsWith(".log"));

        await Promise.all(
          logFiles.map(async (file) => {
            const filePath = path.join(levelPath, file);
            const stats = await fs.promises.stat(filePath);

            if (stats.mtime < cutoffDate) {
              try {
                await fs.promises.unlink(filePath);
                deletedCount++;
                this.debug(`删除过期日志文件: ${path.join(levelDir, file)}`);
              } catch (error) {
                const errorMessage =
                  error instanceof Error ? error.message : String(error);
                this.error(
                  `删除过期日志文件失败: ${path.join(levelDir, file)}`,
                  { error: errorMessage },
                );
              }
            }
          }),
        );
      }),
    );

    return deletedCount;
  }

  static async shutdown(): Promise<void> {
    if (this.instance) {
      try {
        this.instance.close();
        this.instance = null;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.error("关闭日志记录器时出错:", { error: errorMessage });
      }
    }
  }
}
