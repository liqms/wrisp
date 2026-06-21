import { modelService } from "@/main/core/services/model.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type { ApiResponse } from "@/shared/types";
import type { ModelConfig, ModelType } from "@/shared/types/model.types";
import { Logger } from "@/main/utils/logger";

/**
 * 获取完整模型配置
 * @returns 模型配置对象
 */
async function getConfig(): Promise<ApiResponse<ModelConfig>> {
  try {
    const config = modelService.getConfig();
    return response.success(config);
  } catch (error) {
    Logger.error("获取模型配置失败", { error: String(error) });
    return response.error(ErrorCode.MODEL_GET_CONFIG_FAILED, error as Error);
  }
}

/**
 * 根据键路径获取模型配置值
 * @param keyPath - 配置键路径（支持点号分隔的嵌套路径）
 * @returns 配置值
 */
async function getValue(keyPath: string): Promise<ApiResponse<any>> {
  try {
    const value = modelService.getValue(keyPath);
    if (value !== undefined) {
      return response.success(value);
    }
    return response.error(ErrorCode.MODEL_GET_VALUE_FAILED);
  } catch (error) {
    Logger.error("获取模型配置值失败", { keyPath, error: String(error) });
    return response.error(ErrorCode.MODEL_GET_VALUE_FAILED, error as Error);
  }
}

/**
 * 根据键路径设置模型配置值
 * @param keyPath - 配置键路径
 * @param value - 要设置的值
 */
async function setValue(keyPath: string, value: any): Promise<ApiResponse<void>> {
  try {
    Logger.debug("设置配置值 ModelApi", { keyPath, value });
    await modelService.setValue(keyPath, value);
    return response.empty();
  } catch (error) {
    Logger.error("设置模型配置值失败", { keyPath, error: String(error) });
    return response.error(ErrorCode.MODEL_SET_VALUE_FAILED, error as Error);
  }
}

/**
 * 重置模型配置为默认值
 */
async function resetConfig(): Promise<ApiResponse<void>> {
  try {
    await modelService.resetConfig();
    return response.empty();
  } catch (error) {
    Logger.error("重置模型配置失败", { error: String(error) });
    return response.error(ErrorCode.MODEL_RESET_CONFIG_FAILED, error as Error);
  }
}

/**
 * 下载模型文件
 * @param type - 模型类型（base 或 core）
 */
async function downloadModel(type: ModelType): Promise<ApiResponse<string>> {
  try {
    const groupId = await modelService.downloadModel(type);
    return response.success(groupId);
  } catch (error) {
    Logger.error("模型下载失败", { type, error: String(error) });
    return response.error(ErrorCode.MODEL_DOWNLOAD_FAILED, error as Error);
  }
}

/**
 * 检查各模型文件是否已下载
 * @returns 按 modelId 分别返回是否已下载
 */
async function checkModelExist(): Promise<ApiResponse<Record<string, boolean>>> {
  try {
    const exists = await modelService.checkModelExist();
    return response.success(exists);
  } catch (error) {
    Logger.error("检查模型文件失败", { error: String(error) });
    return response.error(ErrorCode.MODEL_CHECK_EXIST_FAILED, error as Error);
  }
}

/**
 * 重新下载模型文件
 * 先删除本地模型文件，再重新下载
 * @param type - 模型类型（base 或 core）
 */
async function reDownloadModel(type: ModelType): Promise<ApiResponse<void>> {
  try {
    await modelService.reDownloadModel(type);
    return response.empty();
  } catch (error) {
    Logger.error("模型重新下载失败", { type, error: String(error) });
    return response.error(ErrorCode.MODEL_REDOWNLOAD_FAILED, error as Error);
  }
}

/**
 * 取消模型下载
 * @param groupId downloadModel 返回的任务组 ID
 */
async function cancelDownload(groupId: string): Promise<ApiResponse<void>> {
  try {
    await modelService.cancelDownload(groupId);
    return response.empty();
  } catch (error) {
    Logger.error("取消模型下载失败", { groupId, error: String(error) });
    return response.error(ErrorCode.MODEL_CANCEL_DOWNLOAD_FAILED, error as Error);
  }
}

export {
  getConfig,
  getValue,
  setValue,
  resetConfig,
  downloadModel,
  checkModelExist,
  reDownloadModel,
  cancelDownload,
};
