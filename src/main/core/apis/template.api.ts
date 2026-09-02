import { templateService } from "@/main/core/services/template.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type { TemplateType } from "@/shared/enums/template.enums";
import type {
  ApiResponse,
  CustomTemplate,
  TemplateFile,
} from "@/shared/types";
import type { TemplateResourceFile } from "@/shared/types/template.types";
import { Logger } from "@/main/utils/logger";

async function getFile(
  type: TemplateType,
): Promise<ApiResponse<TemplateFile>> {
  try {
    return response.success(templateService.getTemplatesFile(type));
  } catch (error) {
    Logger.error("获取模板失败", { error: String(error), type });
    return response.error(ErrorCode.TEMPLATE_GET_FAILED, error as Error);
  }
}

async function upsertCustom(
  type: TemplateType,
  tpl: CustomTemplate,
): Promise<ApiResponse<TemplateFile>> {
  try {
    return response.success(templateService.upsertCustomTemplate(type, tpl));
  } catch (error) {
    Logger.error("保存模板失败", { error: String(error), type });
    return response.error(ErrorCode.TEMPLATE_SAVE_FAILED, error as Error);
  }
}

async function deleteCustom(
  type: TemplateType,
  id: string,
): Promise<ApiResponse<TemplateFile>> {
  try {
    return response.success(templateService.deleteCustomTemplate(type, id));
  } catch (error) {
    Logger.error("删除模板失败", { error: String(error), type });
    return response.error(ErrorCode.TEMPLATE_DELETE_FAILED, error as Error);
  }
}

async function setEnabled(
  type: TemplateType,
  id: string,
  builtIn: boolean,
  enabled: boolean,
): Promise<ApiResponse<TemplateFile>> {
  try {
    return response.success(
      templateService.setTemplateEnabled(type, id, builtIn, enabled),
    );
  } catch (error) {
    Logger.error("更新模板启用状态失败", { error: String(error), type });
    return response.error(ErrorCode.TEMPLATE_SAVE_FAILED, error as Error);
  }
}

async function getBuiltIn(
  type: TemplateType,
): Promise<ApiResponse<TemplateResourceFile[]>> {
  try {
    return response.success(templateService.getBuiltInTemplates(type));
  } catch (error) {
    Logger.error("获取内置模板失败", { error: String(error), type });
    return response.error(ErrorCode.TEMPLATE_GET_FAILED, error as Error);
  }
}

export { getFile, upsertCustom, deleteCustom, setEnabled, getBuiltIn };
