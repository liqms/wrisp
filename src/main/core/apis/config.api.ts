import { configService } from "@/main/core/services/config.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type { AppConfig, ApiResponse } from "@/shared/types";
import { Logger } from "@/main/utils/logger";

/**
 * 获取完整配置
 * @returns 配置对象
 */
async function getConfig(): Promise<ApiResponse<AppConfig>> {
  try {
    const config = configService.getConfig();
    // Logger.debug("获取配置", { config: JSON.stringify(config) });
    return response.success(config);
  } catch (error) {
    Logger.error("获取配置失败", { error: JSON.stringify(error) });
    return response.error(ErrorCode.CONFIG_GET_FAILED, error as Error);
  }
}

/**
 * 根据键路径获取配置值
 * @param keyPath 配置键路径
 * @returns 配置值
 */
async function getValue(keyPath: string): Promise<ApiResponse<any>> {
  try {
    const value = configService.getValue(keyPath);
    if (value !== undefined) {
      return response.success(value);
    } else {
      return response.error(ErrorCode.CONFIG_KEY_PATH_INVALID);
    }
  } catch (error) {
    Logger.error("获取配置值失败", { error: JSON.stringify(error) });
    return response.error(ErrorCode.CONFIG_GET_FAILED, error as Error);
  }
}

/**
 * 根据键路径设置配置值
 * @param keyPath 配置键路径
 * @param value 配置值
 * @returns 设置结果
 */
async function setValue(
  keyPath: string,
  value: any,
): Promise<ApiResponse<void>> {
  try {
    configService.setValue(keyPath, value);
    return response.empty();
  } catch (error) {
    Logger.error("设置配置值失败", { error: JSON.stringify(error) });
    return response.error(ErrorCode.CONFIG_UPDATE_FAILED, error as Error);
  }
}

/**
 * 重置配置为默认值
 * @returns 重置结果
 */
async function resetConfig(): Promise<ApiResponse<void>> {
  try {
    configService.resetConfig();
    return response.empty();
  } catch (error) {
    Logger.error("重置配置失败", { error: JSON.stringify(error) });
    return response.error(ErrorCode.CONFIG_RESET_FAILED, error as Error);
  }
}

/**
 * 设置工作空间路径
 * @param workspacePath 工作空间路径
 * @returns 设置结果
 */
async function setWorkspace(workspacePath: string): Promise<ApiResponse<void>> {
  try {
    configService.setWorkspace(workspacePath);
    return response.empty();
  } catch (error) {
    Logger.error("设置工作空间路径失败", { error: JSON.stringify(error) });
    return response.error(ErrorCode.CONFIG_UPDATE_FAILED, error as Error);
  }
}

export { getConfig, getValue, setValue, resetConfig, setWorkspace };
