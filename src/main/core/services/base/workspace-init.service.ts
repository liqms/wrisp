import fs from "fs";
import path from "path";
import { app } from "electron";
import { Logger } from "@/main/utils/logger";
import { configService } from "@/main/core/services/config.service";
import { RESOURCE_TYPE } from "@/shared/enums/resource.enums";
import {
  SQLITE_DIR,
  MAIN_DB_FILE,
  ATTACHMENTS_DIR,
  ATTACHMENTS_IMAGES_DIR,
  ATTACHMENTS_FILES_DIR,
  RESOURCES_DIR,
} from "@/main/constants/";

/**
 * 工作空间初始化服务
 * 提供首次启动创建目录结构、DB 初始化检查等功能
 */
class WorkspaceInitService {
  private static instance: WorkspaceInitService;

  private constructor() { }

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
      // 附件目录：attachments/images（图片附件）+ attachments/files（普通文件附件）
      fs.mkdirSync(
        path.join(workspacePath, ATTACHMENTS_DIR, ATTACHMENTS_IMAGES_DIR),
        { recursive: true },
      );
      fs.mkdirSync(
        path.join(workspacePath, ATTACHMENTS_DIR, ATTACHMENTS_FILES_DIR),
        { recursive: true },
      );
      // 首次启动：从打包 resources 复制到工作区
      await this.ensureResourcesCopied(workspacePath);
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

  /**
   * 首次启动（<workspace>/resources/ 不存在）时从打包的 resources 整体复制。
   * 后续启动不覆盖（由 resource-sync 负责增量更新）。
   */
  private async ensureResourcesCopied(workspacePath: string): Promise<void> {
    const targetDir = path.join(workspacePath, RESOURCES_DIR);
    if (fs.existsSync(targetDir)) return;

    const isDev = !!process.env.VITE_DEV_SERVER_URL;
    const sourceDir = isDev
      ? path.resolve(app.getAppPath(), "resources")
      : path.join(__dirname, "..", "resources");

    if (!fs.existsSync(sourceDir)) {
      Logger.warn("打包 resources 目录不存在，跳过首次复制", { sourceDir });
      return;
    }
    try {
      fs.mkdirSync(targetDir, { recursive: true });
      this.copyDirectory(sourceDir, targetDir, "", this.isBundledResource);
      Logger.info("首次启动已复制 resources 到工作区", { sourceDir, targetDir });
    } catch (error) {
      Logger.error("复制 resources 失败", { error: String(error), sourceDir, targetDir });
    }
  }

  private copyDirectory(
    src: string,
    dest: string,
    relPath = "",
    filter?: (srcPath: string, relPath: string) => boolean,
  ): void {
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      const entryRel = relPath ? `${relPath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        this.copyDirectory(srcPath, destPath, entryRel, filter);
      } else {
        if (filter && !filter(srcPath, entryRel)) continue;
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * 仅打包通用模板：slash/page 下 profession 含 general（或缺失/为空）的文件才复制；
   * skills/schemas/manifest.json 全量复制。
   */
  private isBundledResource(srcPath: string, relPath: string): boolean {
    const type = relPath.split("/")[0];
    if (type !== RESOURCE_TYPE.SLASH && type !== RESOURCE_TYPE.PAGE) return true;
    if (!relPath.endsWith(".json")) return false;
    try {
      const parsed = JSON.parse(fs.readFileSync(srcPath, "utf-8")) as {
        profession?: unknown;
      };
      const profession = Array.isArray(parsed.profession)
        ? parsed.profession
        : [];
      return profession.length === 0 || profession.includes("general");
    } catch {
      return false;
    }
  }
}

export default WorkspaceInitService;

export const workspaceInitService = WorkspaceInitService.getInstance();