/**
 * 附件相关类型定义
 * 附件存储于工作空间 attachments/ 目录（images/ 图片、files/ 普通文件），
 * 通过 app://workspace/<相对路径> 自定义协议在渲染进程中访问。
 */

/** 允许导入的图片扩展名（小写，不含点） */
export const IMAGE_FILE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "svg",
  "ico",
  "avif",
] as const;

/**
 * 判断文件名是否为允许导入的图片格式
 * @param fileName - 文件名（含扩展名）
 * @returns 是图片格式返回 true
 */
export function isImageFileName(fileName: string): boolean {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return false;
  const ext = fileName.slice(dot + 1).toLowerCase();
  return (IMAGE_FILE_EXTENSIONS as readonly string[]).includes(ext);
}

/** 导入图片结果：url 可直接用于 <img src> / 图片节点 */
export interface ImportedImage {
  /** 附件访问地址（app://workspace/attachments/images/<文件名>） */
  url: string;
  /** 原始文件名（含扩展名，用作图片 alt 文本） */
  fileName: string;
}
