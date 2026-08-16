import { app } from "electron";
import fs from "fs";
import Store from "electron-store";
import path from "path";
import { AppConfig } from "@/shared/types";
import { TimeUtil, ObjectUtil } from "@/shared/utils";
import { Logger, getAppVersion, needsMigration } from "@/main/utils";
import { DEFAULT_APP_CONFIG } from "@/main/constants";
import { configMigration } from "@/main/core/migration";
import { closeDatabase, setWorkspacePath } from "@/main/core/db/connection";
import { BrowserWindow } from "electron";
import { databaseMigration } from "@/main/core/migration/database.migration";
import { CONFIG_DIR } from "@/main/constants";

/**
 * 配置服务
 * 提供应用配置的管理功能，包括配置的加载、保存、读取、更新和重置
 * 使用 electron-store 进行配置持久化，支持配置迁移和版本管理
 */
class ConfigService {
  private static instance: ConfigService | null = null;
  private store: Store<AppConfig>;
  private config: AppConfig | null = null;
  private appPath: string;
  private userDataPath: string;
  private configFileName: string;
  private defaultConfig: AppConfig | null = null;

  /**
   * 私有构造函数
   * 初始化配置服务，设置应用路径、加载默认配置和用户配置
   */
  private constructor() {
    this.appPath = app.getAppPath();
    this.userDataPath = app.getPath("userData");
    this.configFileName = "app";


    const configDir = path.join(this.userDataPath, CONFIG_DIR);
    fs.mkdirSync(configDir, { recursive: true });

    this.defaultConfig = this.getDefaultConfig();

    this.store = new Store<AppConfig>({
      name: this.configFileName,
      cwd: configDir,
      fileExtension: "json",
      clearInvalidConfig: true,
      defaults: this.defaultConfig,
    });

    const workspaceDir = this.config?.workspace;

    this.loadConfig();

    // 加载配置后同步设置工作空间路径到数据库连接模块
    if (workspaceDir && workspaceDir.trim() !== "") {
      setWorkspacePath(workspaceDir);
    }
  }

  /**
   * 获取 ConfigService 的单例实例
   * @returns ConfigService 单例实例
   */
  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    Logger.info("获取 ConfigService 单例实例");
    return ConfigService.instance;
  }

  /**
   * 获取默认配置
   * @returns 默认的 AppConfig 对象
   */
  private getDefaultConfig(): AppConfig {
    const now = TimeUtil.toISOString(new Date());
    const appVersion = getAppVersion();
    const documentsPath = app.getPath("documents");
    const defaultWorkspace = path.join(documentsPath, "Wrisp");

    return {
      ...DEFAULT_APP_CONFIG,
      workspace: defaultWorkspace,
      version: appVersion,
      updatedAt: now,
    };
  }

  /**
   * 从存储中加载配置
   */
  private loadConfig(): void {
    try {
      const storeData = this.store.store;
      const defaultConfig = this.defaultConfig || this.getDefaultConfig();

      let mergedConfig = ObjectUtil.deepMerge(
        defaultConfig,
        storeData as Partial<AppConfig>,
      );

      if (!mergedConfig.workspace || mergedConfig.workspace.trim() === "") {
        mergedConfig.workspace = defaultConfig.workspace;
        Logger.debug("工作目录为空, 使用默认值", {
          工作目录: mergedConfig.workspace,
        });
      }

      // 检查版本并执行迁移
      const appVersion = getAppVersion();
      const configVersion = mergedConfig.version || "0.0.0";

      if (needsMigration(configVersion, appVersion)) {
        Logger.info("检测到版本升级，执行配置迁移", {
          configVersion,
          appVersion,
        });

        mergedConfig = configMigration.migrateConfig(
          mergedConfig,
          configVersion,
          appVersion,
        );
      }

      this.config = mergedConfig;

      Logger.debug("AppConfig 加载配置成功");
    } catch (error) {
      Logger.error("加载配置失败, 使用默认配置", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      this.config = this.defaultConfig || this.getDefaultConfig();
      this.saveConfig();
    }
  }

  /**
   * 保存配置到存储
   */
  private saveConfig(): void {
    try {
      if (this.config) {
        this.store.set(this.config);
      }
    } catch (error) {
      Logger.error("保存配置到存储失败", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * 获取当前配置
   * @returns 当前的 AppConfig 对象
   */
  public getConfig(): AppConfig {
    if (!this.config) {
      this.loadConfig();
    }
    return this.config!;
  }

  /**
   * 根据键路径获取配置值
   * @param keyPath - 配置键路径（支持点号分隔的嵌套路径）
   * @returns 配置值或 undefined
   * @template T - 返回值的类型
   */
  public getValue<T>(keyPath: string): T | undefined {
    try {
      const keys = keyPath.split(".");
      let result: unknown = this.config!;

      for (const key of keys) {
        if (
          result !== null &&
          typeof result === "object" &&
          key in result
        ) {
          result = (result as Record<string, unknown>)[key];
        } else {
          return undefined;
        }
      }

      return result as T;
    } catch (error) {
      Logger.error("获取配置值失败", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return undefined;
    }
  }

  /**
   * 根据键路径设置配置值
   * @param keyPath - 配置键路径（支持点号分隔的嵌套路径）
   * @param value - 要设置的值
   * @template T - 值的类型
   */
  public setValue<T>(keyPath: string, value: T): void {
    try {
      const keys = keyPath.split(".");
      const lastKey = keys.pop()!;
      let target: unknown = this.config!;

      for (const key of keys) {
        if (
          target !== null &&
          typeof target === "object" &&
          key in target
        ) {
          target = (target as Record<string, unknown>)[key];
        } else {
          Logger.error(`AppConfig 配置键路径不存在: ${keyPath}`);
        }
      }

      if (target !== null && typeof target === "object" && lastKey in target) {
        (target as Record<string, unknown>)[lastKey] = value;
        this.saveConfig();
      } else {
        Logger.error(`AppConfig 配置键路径不存在: ${keyPath}`);
      }
    } catch (error) {
      Logger.error("AppConfig 设置配置值失败", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * 重置配置为默认值
   * @returns 操作结果错误码
   */
  public resetConfig(): void {
    try {
      this.config = this.defaultConfig || this.getDefaultConfig();
      this.saveConfig();
      Logger.info("AppConfig 重置为默认值");
    } catch (error) {
      Logger.error("AppConfig 重置配置失败", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
  /**
   * 设置工作空间路径并完成初始化
   * 关闭旧数据库连接 → 更新配置 → 创建目录 → 初始化新数据库
   * @param workspacePath - 新的工作空间路径
   */
  public setWorkspace(workspacePath: string): void {
    try {
      if (!workspacePath || workspacePath.trim() === "") {
        throw new Error("工作空间路径不能为空");
      }
      const newWorkspace = path.join(workspacePath.trim(), "Wrisp");
      const normalizedPath = path.resolve(newWorkspace);
      if (!fs.existsSync(normalizedPath)) {
        fs.mkdirSync(normalizedPath, { recursive: true });
      }

      Logger.info("开始设置工作空间", {
        oldPath: this.config?.workspace,
        newPath: normalizedPath,
      });

      try {
        closeDatabase();
      } catch (e) {
        Logger.warn("关闭旧数据库连接时出现警告", {
          error: e instanceof Error ? e.message : String(e),
        });
      }

      this.setValue("workspace", normalizedPath);
      setWorkspacePath(normalizedPath);

      databaseMigration.executeDatabaseMigration();

      Logger.info("工作空间设置完成", { path: normalizedPath });

      // 广播工作区变更事件，通知所有渲染进程刷新配置或重载相关资源
      try {
        BrowserWindow.getAllWindows().forEach((win) => {
          try {
            win.webContents.send("workspace:changed", normalizedPath);
          } catch (e) {
            Logger.warn("向窗口发送 workspace:changed 事件失败", { error: e });
          }
        });
      } catch (e) {
        Logger.warn("广播 workspace:changed 事件失败", { error: e });
      }
    } catch (error) {
      Logger.error("设置工作空间失败", {
        path: workspacePath,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * 获取应用资源路径 staticPath
   * @returns 应用资源路径staticPath
   */
  public getStaticPath(type?: string): string {
    if (type === "userData") {
      return path.join(this.userDataPath, "Cache", "static");
    }
    return path.join(this.appPath, "static");
  }

  /**
   * 获取应用工作空间路径 workspacePath
   */
  public getWorkspacePath(): string {
    return this.config?.workspace || "";
  }
}

export default ConfigService;

export const configService = ConfigService.getInstance();
