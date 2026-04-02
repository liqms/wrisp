import { configService } from "@/main/core/services/config.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type { AppConfig, ApiResponse } from "@/shared/types";

/**
 * 获取完整配置
 * @returns 配置对象
 */
async function getConfig(): Promise<ApiResponse<AppConfig>> {
  try {
    const config = configService.getConfig();
    return response.success(config);
  } catch (error) {
    return response.error(ErrorCode.CONFIG_GET_FAILED, error as Error);
  }
}

/**
 * 更新配置
 * @param config 部分配置对象
 * @returns 更新结果
 */
async function setConfig(config: Partial<AppConfig>): Promise<ApiResponse<void>> {
  try {
    configService.setConfig(config);
    return response.empty();
  } catch (error) {
    return response.error(ErrorCode.CONFIG_UPDATE_FAILED, error as Error);
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
    return response.error(ErrorCode.CONFIG_GET_FAILED, error as Error);
  }
}

/**
 * 根据键路径设置配置值
 * @param keyPath 配置键路径
 * @param value 配置值
 * @returns 设置结果
 */
async function setValue(keyPath: string, value: any): Promise<ApiResponse<void>> {
  try {
    configService.setValue(keyPath, value);
    return response.empty();
  } catch (error) {
    return response.error(ErrorCode.CONFIG_UPDATE_FAILED, error as Error);
  }
}

/**
 * 获取资源基础路径
 * @returns 资源基础路径
 */
async function getStaticPath(): Promise<ApiResponse<string>> {
  try {
    const path = configService.getStaticPath();
    return response.success(path);
  } catch (error) {
    return response.error(ErrorCode.CONFIG_GET_FAILED, error as Error);
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
    return response.error(ErrorCode.CONFIG_RESET_FAILED, error as Error);
  }
}

export {
  getConfig,
  setConfig,
  getValue,
  setValue,
  getStaticPath,
  resetConfig
}

