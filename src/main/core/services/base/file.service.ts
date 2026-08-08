import fs from "fs";
import path from "path";
import { configService } from "@/main/core/services/config.service";
import { Logger, NodeCryptoUtil } from "@/main/utils";

class FileService {
  private static instance: FileService;

  private constructor() { }

  public static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService();
    }
    return FileService.instance;
  }

  private getWorkspacePath(): string {
    return configService.getValue<string>("workspace") || "";
  }

  private resolvePath(relativePath: string): string {
    const workspacePath = this.getWorkspacePath();
    const resolvedPath = path.resolve(workspacePath, relativePath);

    if (!resolvedPath.startsWith(workspacePath + path.sep) && resolvedPath !== workspacePath) {
      Logger.error("文件路径越界，拒绝访问", {
        relativePath,
        workspacePath,
        resolvedPath,
      });
      throw new Error("文件路径越界，拒绝访问");
    }

    return resolvedPath;
  }

  public exists(path: string): boolean {
    try {
      const absolutePath = this.resolvePath(path);
      return fs.existsSync(absolutePath);
    } catch (error) {
      Logger.error("检查文件是否存在失败", {
        path,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  public ensureDir(dirPath: string): void {
    try {
      const absolutePath = this.resolvePath(dirPath);
      fs.mkdirSync(absolutePath, { recursive: true });
    } catch (error) {
      Logger.error("创建目录失败", {
        dirPath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  public listFiles(dirPath: string, ext: string): string[] {
    try {
      const absolutePath = this.resolvePath(dirPath);

      if (!fs.existsSync(absolutePath)) {
        return [];
      }

      const normalizedExt = ext.startsWith(".") ? ext : `.${ext}`;
      const files: string[] = [];
      const items = fs.readdirSync(absolutePath, { withFileTypes: true });

      for (const item of items) {
        if (item.isFile()) {
          const itemPath = path.join(dirPath, item.name);
          if (path.extname(item.name) === normalizedExt) {
            files.push(itemPath);
          }
        } else if (item.isDirectory()) {
          const subFiles = this.listFiles(path.join(dirPath, item.name), ext);
          files.push(...subFiles);
        }
      }

      return files;
    } catch (error) {
      Logger.error("列出文件失败", {
        dirPath,
        ext,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  public readFile(filePath: string): string {
    try {
      const absolutePath = this.resolvePath(filePath);
      return fs.readFileSync(absolutePath, "utf-8");
    } catch (error) {
      Logger.error("读取文件失败", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  public writeFile(filePath: string, content: string): void {
    try {
      const absolutePath = this.resolvePath(filePath);
      const dir = path.dirname(absolutePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(absolutePath, content, "utf-8");
    } catch (error) {
      Logger.error("写入文件失败", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  public copy(src: string, dest: string): void {
    try {
      const absoluteSrc = this.resolvePath(src);
      const absoluteDest = this.resolvePath(dest);
      fs.cpSync(absoluteSrc, absoluteDest, { recursive: true });
    } catch (error) {
      Logger.error("复制文件失败", {
        src,
        dest,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * 获取文件基本信息（大小、修改时间、哈希）
   * @param relativePath - 相对工作区的文件路径
   * @returns 文件基本信息对象，文件不存在时返回 null
   */
  public getFileInfo(relativePath: string): { size: number; modifiedAt: string; hash: string } | null {
    try {
      const absolutePath = this.resolvePath(relativePath);
      if (!fs.existsSync(absolutePath)) {
        return null;
      }
      const stats = fs.statSync(absolutePath);
      const content = fs.readFileSync(absolutePath);
      const hash = NodeCryptoUtil.md5(content.toString("utf-8"));
      return {
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        hash,
      };
    } catch (error) {
      Logger.error("获取文件信息失败", {
        path: relativePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  public remove(path: string): void {
    try {
      const absolutePath = this.resolvePath(path);
      fs.rmSync(absolutePath, { recursive: true, force: true });
    } catch (error) {
      Logger.error("删除文件/目录失败", {
        path,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}

export default FileService;

export const fileService = FileService.getInstance();