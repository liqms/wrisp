import fs from "fs";
import path from "path";
import { dialog } from "electron";
import { configService } from "@/main/core/services/config.service";
import { Logger } from "@/main/utils/logger";
import { t } from "@/main/utils/i18n";
import {
  ATTACHMENTS_DIR,
  ATTACHMENTS_IMAGES_DIR,
} from "@/main/constants/folder.constants";
import {
  IMAGE_FILE_EXTENSIONS,
  type ImportedImage,
} from "@/shared/types/attachment.types";

/**
 * 附件服务
 * 负责将本地文件导入工作空间 attachments/ 目录：
 * - attachments/images/ 图片附件
 * - attachments/files/ 普通文件附件（预留）
 * 渲染进程通过 app://workspace/<相对路径> 协议访问（见 src/main/protocol.ts）
 */
class AttachmentService {
  private static instance: AttachmentService | null = null;

  private constructor() { }

  public static getInstance(): AttachmentService {
    if (!AttachmentService.instance) {
      AttachmentService.instance = new AttachmentService();
    }
    return AttachmentService.instance;
  }

  /** 图片附件目录（<workspace>/attachments/images） */
  public getImagesDir(): string {
    const workspace = configService.getWorkspacePath();
    if (!workspace || workspace.trim() === "") {
      throw new Error("工作空间未配置，无法导入附件");
    }
    return path.join(workspace, ATTACHMENTS_DIR, ATTACHMENTS_IMAGES_DIR);
  }

  /**
   * 打开系统文件选择框（仅允许图片格式）
   * @returns 选中的文件绝对路径；用户取消返回 null
   */
  public async pickImageFile(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title: t("ATTACHMENT.DIALOG_TITLE"),
      properties: ["openFile"],
      filters: [
        {
          name: t("ATTACHMENT.DIALOG_FILTER_IMAGES"),
          extensions: [...IMAGE_FILE_EXTENSIONS],
        },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  }

  /**
   * 将图片复制到工作空间图片附件目录
   * 存储文件以导入时间戳重命名（如 20260829153045123.png），避免重名冲突；
   * 同一毫秒内多次导入的极端场景追加 -1/-2 序号兜底。
   * @param sourcePath - 源文件绝对路径
   * @returns 导入结果（含 app://workspace 访问 URL；fileName 保留原始文件名用作 alt 文本）
   */
  public async copyImageToWorkspace(sourcePath: string): Promise<ImportedImage> {
    const imagesDir = this.getImagesDir();
    fs.mkdirSync(imagesDir, { recursive: true });

    const originalName = path.basename(sourcePath);
    const storedName = `${buildTimestampName()}${path.extname(originalName)}`;
    const targetPath = this.resolveUniquePath(imagesDir, storedName);
    await fs.promises.copyFile(sourcePath, targetPath);

    Logger.info("图片附件导入成功", {
      source: sourcePath,
      target: targetPath,
    });

    return {
      url: `app://workspace/${ATTACHMENTS_DIR}/${ATTACHMENTS_IMAGES_DIR}/${path.basename(targetPath)}`,
      fileName: originalName,
    };
  }

  /** 目标路径已存在时追加 -1/-2… 序号，避免覆盖既有附件 */
  private resolveUniquePath(dir: string, fileName: string): string {
    const ext = path.extname(fileName);
    const stem = fileName.slice(0, fileName.length - ext.length) || "image";
    let candidate = path.join(dir, fileName);
    let counter = 1;
    while (fs.existsSync(candidate)) {
      candidate = path.join(dir, `${stem}-${counter}${ext}`);
      counter += 1;
    }
    return candidate;
  }
}

/**
 * 生成时间戳文件名主干：YYYYMMDDHHmmssSSS（毫秒精度，天然唯一且按导入时间排序）
 */
export function buildTimestampName(now: Date = new Date()): string {
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}` +
    pad(now.getMilliseconds(), 3)
  );
}

export default AttachmentService;

export const attachmentService = AttachmentService.getInstance();
