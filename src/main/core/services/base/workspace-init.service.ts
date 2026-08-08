import fs from "fs";
import path from "path";
import { Logger } from "@/main/utils/logger";
import { configService } from "@/main/core/services/config.service";
import { SQLITE_DIR, MAIN_DB_FILE } from "@/main/constants/";

/**
 * 工作空间初始化服务
 * 提供首次启动创建目录结构、DB 初始化检查等功能
 */
class WorkspaceInitService {
  private static instance: WorkspaceInitService;

  private constructor() {}

  public static getInstance(): WorkspaceInitService {
    if (!WorkspaceInitService.instance) {
      WorkspaceInitService.instance = new WorkspaceInitService();
    }
    return WorkspaceInitService.instance;
  }

  /**
   * 获取工作空间路径
   */
  public getWorkspacePath(): string {
    return configService.getValue<string>("workspace") || "";
  }

  /**
   * 确保工作空间就绪，创建必要目录
   */
  public async ensureWorkspace(): Promise<void> {
    const workspacePath = this.getWorkspacePath();
    if (!workspacePath) {
      Logger.warn("工作空间路径未配置");
      return;
    }

    try {
      fs.mkdirSync(path.join(workspacePath, "sqlite"), { recursive: true });
      Logger.info("工作空间已就绪", { workspacePath });
    } catch (error) {
      Logger.error("确保工作空间就绪失败", {
        error: String(error),
        workspacePath,
      });
      throw error;
    }
  }

  /**
   * 判断是否为首次运行
   */
  public isFirstRun(): boolean {
    const workspacePath = this.getWorkspacePath();
    if (!workspacePath) {
      return true;
    }
    return !fs.existsSync(path.join(workspacePath, SQLITE_DIR, MAIN_DB_FILE));
  }
}

export default WorkspaceInitService;

export const workspaceInitService = WorkspaceInitService.getInstance();