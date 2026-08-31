import type { ApiResponse, ImportedImage } from '@/shared/types'

export interface AttachmentAPI {
  /**
   * 导入图片附件：打开图片选择框（仅图片格式），
   * 复制到工作空间 attachments/images/ 目录并返回 app:// 访问 URL。
   * 用户取消时 data 为 null。
   */
  importImage(): Promise<ApiResponse<ImportedImage | null>>
}
