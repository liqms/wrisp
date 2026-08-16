import { templateService } from "@/main/core/services/template.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type {
  ApiResponse,
  CustomTemplate,
  SlashTemplateFile,
} from "@/shared/types";
import { Logger } from "@/main/utils/logger";

async function getFile(): Promise<ApiResponse<SlashTemplateFile>> {
  try {
    return response.success(templateService.getSlashTemplatesFile());
  } catch (error) {
    Logger.error("获取 slash 模板失败", { error: String(error) });
    return response.error(ErrorCode.TEMPLATE_GET_FAILED, error as Error);
  }
}

async function upsertCustom(
  tpl: CustomTemplate,
): Promise<ApiResponse<SlashTemplateFile>> {
  try {
    return response.success(templateService.upsertCustomTemplate(tpl));
  } catch (error) {
    Logger.error("保存 slash 模板失败", { error: String(error) });
    return response.error(ErrorCode.TEMPLATE_SAVE_FAILED, error as Error);
  }
}

async function deleteCustom(
  id: string,
): Promise<ApiResponse<SlashTemplateFile>> {
  try {
    return response.success(templateService.deleteCustomTemplate(id));
  } catch (error) {
    Logger.error("删除 slash 模板失败", { error: String(error) });
    return response.error(ErrorCode.TEMPLATE_DELETE_FAILED, error as Error);
  }
}

async function setEnabled(
  id: string,
  builtIn: boolean,
  enabled: boolean,
): Promise<ApiResponse<SlashTemplateFile>> {
  try {
    return response.success(
      templateService.setTemplateEnabled(id, builtIn, enabled),
    );
  } catch (error) {
    Logger.error("更新模板启用状态失败", { error: String(error) });
    return response.error(ErrorCode.TEMPLATE_SAVE_FAILED, error as Error);
  }
}

export { getFile, upsertCustom, deleteCustom, setEnabled };
