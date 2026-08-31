import {
  attachmentService,
} from "@/main/core/services/attachment.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type { ApiResponse, ImportedImage } from "@/shared/types";
import { isImageFileName } from "@/shared/types/attachment.types";
import { Logger } from "@/main/utils/logger";

/**
 * 导入图片附件：
 * 打开图片选择框 → 复制到 <workspace>/attachments/images/ → 返回 app:// 访问 URL。
 * 用户取消时返回 data=null（success）；格式校验失败/复制失败返回错误响应。
 */
async function importImage(): Promise<ApiResponse<ImportedImage | null>> {
  try {
    const picked = await attachmentService.pickImageFile();
    if (!picked) {
      // 用户取消选择，不插入任何内容
      return response.success(null);
    }

    // 对话框已限制图片格式，此处兜底校验（防御“所有文件”类筛选器绕过）
    if (!isImageFileName(picked)) {
      Logger.warn("导入附件被拒绝：非图片格式", { file: picked });
      return response.error(ErrorCode.ATTACHMENT_INVALID_IMAGE_FORMAT);
    }

    const imported = await attachmentService.copyImageToWorkspace(picked);
    return response.success(imported);
  } catch (error) {
    Logger.error("导入图片附件失败", { error: String(error) });
    return response.error(ErrorCode.ATTACHMENT_IMPORT_IMAGE_FAILED, error as Error);
  }
}

export { importImage };
