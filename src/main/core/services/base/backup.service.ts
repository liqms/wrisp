import fs from "fs";
import path from "path";
import { app } from "electron";
import { Logger } from "@/main/utils/logger";
import { SQLITE_DIR } from "@/main/constants";

/**
 * 备份服务
 * 提供 DB/配置备份与恢复功能
 */
class BackupService {
  private static instance: BackupService;

  private constructor() {}

  public static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  /**
   * 获取备份目录路径
   */
  private getBackupDir(): string {
    const userDataPath = app.getPath("userData");
    return path.join(userDataPath, "backups");
  }

  /**
   * 创建备份
   * 备份 DB 文件和配置文件到备份目录
   * @returns 备份路径
   */
  public async createBackup(): Promise<string> {
    const backupDir = this.getBackupDir();
    fs.mkdirSync(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir, `backup-${timestamp}`);
    fs.mkdirSync(backupPath, { recursive: true });

    try {
      // 备份配置文件
      const configDir = path.join(app.getPath("userData"), "config");
      if (fs.existsSync(configDir)) {
        fs.cpSync(configDir, path.join(backupPath, "config"), {
          recursive: true,
        });
      }

      // 备份数据库文件
      const workspacePath =
        (globalThis as any).__WRISP_WORKSPACE_PATH__ || "";
      if (workspacePath) {
        const dbDir = path.join(workspacePath, SQLITE_DIR);
        if (fs.existsSync(dbDir)) {
          fs.cpSync(dbDir, path.join(backupPath, SQLITE_DIR), {
            recursive: true,
          });
        }
      }

      Logger.info("备份创建成功", { backupPath });
      return backupPath;
    } catch (error) {
      Logger.error("备份创建失败", { error: String(error) });
      throw error;
    }
  }

  /**
   * 从备份恢复
   * @param restorePath 备份路径
   */
  public async restore(restorePath: string): Promise<void> {
    if (!fs.existsSync(restorePath)) {
      throw new Error(`备份路径不存在: ${restorePath}`);
    }

    try {
      // 恢复配置文件
      const configBackup = path.join(restorePath, "config");
      if (fs.existsSync(configBackup)) {
        const configDir = path.join(app.getPath("userData"), "config");
        fs.mkdirSync(configDir, { recursive: true });
        fs.cpSync(configBackup, configDir, { recursive: true });
      }

      // 恢复数据库文件
      const dbBackup = path.join(restorePath, "sqlite");
      if (fs.existsSync(dbBackup)) {
        const workspacePath =
          (globalThis as any).__WRISP_WORKSPACE_PATH__ || "";
        if (workspacePath) {
          const dbDir = path.join(workspacePath, "sqlite");
          fs.mkdirSync(dbDir, { recursive: true });
          fs.cpSync(dbBackup, dbDir, { recursive: true });
        }
      }

      Logger.info("备份恢复成功", { restorePath });
    } catch (error) {
      Logger.error("备份恢复失败", { error: String(error) });
      throw error;
    }
  }

  /**
   * 列出所有备份
   */
  public listBackups(): string[] {
    const backupDir = this.getBackupDir();
    if (!fs.existsSync(backupDir)) {
      return [];
    }
    return fs
      .readdirSync(backupDir)
      .filter((name) =>
        fs.statSync(path.join(backupDir, name)).isDirectory(),
      )
      .map((name) => path.join(backupDir, name));
  }

  /**
   * 清理旧备份，保留 N 个
   */
  public cleanOldBackups(retainCount: number): void {
    const backupDir = this.getBackupDir();
    if (!fs.existsSync(backupDir)) {
      return;
    }

    const backups = fs
      .readdirSync(backupDir)
      .filter((name) =>
        fs.statSync(path.join(backupDir, name)).isDirectory(),
      )
      .map((name) => ({
        name,
        time: fs.statSync(path.join(backupDir, name)).mtimeMs,
      }))
      .sort((a, b) => b.time - a.time);

    if (backups.length > retainCount) {
      backups.slice(retainCount).forEach((b) => {
        fs.rmSync(path.join(backupDir, b.name), {
          recursive: true,
          force: true,
        });
      });
      Logger.info("清理旧备份完成", {
        保留数量: retainCount,
        清理数量: backups.length - retainCount,
      });
    }
  }
}

export default BackupService;

export const backupService = BackupService.getInstance();