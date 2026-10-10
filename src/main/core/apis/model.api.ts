import { modelService } from "@/main/core/services/ai/model.service";
import { localAiManager } from "@/main/core/model-gateway/local-gateway";
import { getModelManifest as buildModelManifest } from "@/main/core/model-gateway/local-gateway/model-registry";
import { downloadService } from "@/main/core/services/system/download.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type { ApiResponse } from "@/shared/types";
import type { DownloadProgress } from "@/main/types/download.types";
import type { GpuCapability, ModelConfig, ModelManifestEntry, ModelType, ThreadBudgetInfo } from "@/shared/types/model.types";
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
async function getValue(keyPath: string): Promise<ApiResponse<unknown>> {
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
 * 把配置中的 GPU 开关推给本地网关
 * manager 不反向依赖配置服务（保持可独立测试），因此开关变化由 API 层负责同步。
 */
function syncGpuSwitch(): void {
  localAiManager.setGpuAccelerationEnabled(
    modelService.getConfig().enableGpuAcceleration === true,
  );
}

/**
 * 根据键路径设置模型配置值
 * @param keyPath - 配置键路径
 * @param value - 要设置的值
 */
async function setValue(keyPath: string, value: unknown): Promise<ApiResponse<void>> {
  try {
    Logger.debug("设置配置值 ModelApi", { keyPath, value });
    await modelService.setValue(keyPath, value);
    syncGpuSwitch();
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
    syncGpuSwitch();
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

/**
 * 获取本地 LLM 的 GPU 能力快照
 * 仅在用户开关打开时才探测显存；开关关闭时返回 disabled 判定，不产生任何 GPU 初始化。
 */
async function getGpuCapability(): Promise<ApiResponse<GpuCapability>> {
  try {
    syncGpuSwitch();
    const capability = await localAiManager.getGpuCapability();
    return response.success(capability);
  } catch (error) {
    Logger.error("获取 GPU 能力失败", { error: String(error) });
    return response.error(ErrorCode.MODEL_GPU_PROBE_FAILED, error as Error);
  }
}

/**
 * 获取当前生效的推理线程预算（设置页展示「实际会用几个线程」）。
 * 线程数由 config.api 在写配置与启动时推入 manager，此处只读不写。
 */
async function getThreadBudget(): Promise<ApiResponse<ThreadBudgetInfo>> {
  try {
    return response.success(localAiManager.getThreadBudget());
  } catch (error) {
    Logger.error("获取线程预算失败", { error: String(error) });
    return response.error(ErrorCode.MODEL_GET_CONFIG_FAILED, error as Error);
  }
}

/**
 * 获取内置模型清单（默认变体的文件集与体积）。
 * 渲染进程据此按模型聚合下载进度，取代此前在两个组件里手抄的 MODEL_DEFS。
 * 纯内存投影，不落盘不联网，故不做 try/catch 包装。
 */
async function getModelManifest(): Promise<ApiResponse<ModelManifestEntry[]>> {
  return response.success(buildModelManifest());
}

/**
 * 获取当前所有下载任务的状态快照。
 * 渲染进程的下载 store 只靠 download:progress 事件累积，刷新或重开设置页后状态会丢；
 * 此接口用于进页面时一次性补齐。同样是纯内存读取。
 */
async function getDownloadTasks(): Promise<ApiResponse<DownloadProgress[]>> {
  return response.success(downloadService.getAllTasks());
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
  getGpuCapability,
  getThreadBudget,
  getModelManifest,
  getDownloadTasks,
};
