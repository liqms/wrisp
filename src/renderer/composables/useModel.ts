import { computed, ref } from "vue";
import { useModelStore } from "@/renderer/store/model.store";
import { logger } from "@/renderer/utils/logger.utils";
import type { AIProvider, DefaultModel, ModelType } from "@/shared/types/model.types";

interface UseModelOptions {
  /** 是否自动初始化配置 */
  autoInit?: boolean;
}

/**
 * 模型相关的组合函数
 */
export function useModel(options: UseModelOptions = {}) {
  const { autoInit = true } = options;
  const modelStore = useModelStore();

  // 响应式状态
  const config = computed(() => modelStore.config);
  const loading = computed(() => modelStore.loading);
  const isLoaded = computed(() => modelStore.isLoaded);
  const errorCode = computed(() => modelStore.errorCode);
  const errorMessage = computed(() => modelStore.errorMessage);

  // 派生计算属性
  const providers = computed(() => config.value?.aiProviders ?? ([] as AIProvider[]));
  const defaultModels = computed(() => config.value?.defaultModels ?? ([] as DefaultModel[]));
  const providerPriority = computed(() => config.value?.providerPriority ?? ([] as string[]));
  const enableCloudAi = computed(() => config.value?.enableCloudAi ?? false);
  const enableAiMode = computed(() => config.value?.enableAiMode ?? false);

  // 模型下载状态跟踪
  const downloadGroupId = ref<string | null>(null);
  const isDownloadingModels = ref(false);

  /**
   * 初始化模型配置
   */
  async function init(): Promise<boolean> {
    if (modelStore.isLoaded) return true;
    return await modelStore.fetchConfig();
  }

  /**
   * 确保配置已加载
   */
  async function ensureLoaded(): Promise<boolean> {
    if (modelStore.isLoaded) return true;
    return await init();
  }

  /**
   * 获取特定配置项的值
   */
  async function getValue<T = any>(keyPath: string): Promise<T | null> {
    if (!(await ensureLoaded())) return null;
    return await modelStore.getConfigValue(keyPath);
  }

  /**
   * 设置特定配置项的值
   */
  async function setValue<T = any>(keyPath: string, value: T): Promise<boolean> {
    if (!(await ensureLoaded())) return false;
    return await modelStore.setConfigValue(keyPath, value);
  }

  /**
   * 重置模型配置为默认值
   */
  async function resetConfig(): Promise<boolean> {
    return await modelStore.resetModelConfig();
  }

  /**
   * 下载模型文件
   */
  async function downloadModel(type: ModelType): Promise<string | null> {
    return await modelStore.downloadModel(type);
  }

  /**
   * 检查各模型文件是否已下载
   */
  async function checkModelExist(): Promise<Record<string, boolean> | null> {
    return await modelStore.checkModelExist();
  }

  /**
   * 重新下载模型文件
   */
  async function reDownloadModel(type: ModelType): Promise<boolean> {
    return await modelStore.reDownloadModel(type);
  }

  /**
   * 取消模型下载
   */
  async function cancelDownload(groupId: string): Promise<boolean> {
    return await modelStore.cancelDownload(groupId);
  }

  /**
   * 切换本地智能模式
   * 开启时：更新配置并开始下载模型
   * 关闭时：取消正在下载的任务并更新配置
   */
  async function updateEnableAiMode(enable: boolean): Promise<boolean> {
    if (enable) {
      // 开启：更新配置
      const configUpdated = await setValue("enableAiMode", true);
      if (!configUpdated) return false;

      // 先检查模型是否已下载完成
      const modelExists = await checkModelExist();
      if (modelExists) {
        const allExist = Object.values(modelExists).every(Boolean);
        if (allExist) {
          logger.info("模型文件已存在，无需下载");
          return true;
        }
      }

      // 模型未下载，启动下载
      const groupId = await modelStore.downloadModel("base");
      if (groupId) {
        downloadGroupId.value = groupId;
        isDownloadingModels.value = true;
      }
      return groupId !== null;
    } else {
      // 关闭：取消下载任务 → 更新配置
      if (downloadGroupId.value) {
        await modelStore.cancelDownload(downloadGroupId.value);
        downloadGroupId.value = null;
        isDownloadingModels.value = false;
      }
      return await setValue("enableAiMode", false);
    }
  }

  /**
   * 更新是否启用云AI
   */
  async function updateEnableCloudAi(newEnableCloudAi: boolean): Promise<boolean> {
    return await setValue("enableCloudAi", newEnableCloudAi);
  }

  /**
   * 更新默认模型列表（全量替换）
   */
  async function addOrUpdateDefaultModel(models: DefaultModel[]): Promise<boolean> {
    if (!(await ensureLoaded())) return false;
    return await modelStore.addOrUpdateDefaultModel(models);
  }

  /**
   * 添加或更新 AI 供应商
   */
  async function addOrUpdateAIProvider(provider: AIProvider): Promise<boolean> {
    if (!(await ensureLoaded())) return false;
    logger.debug(`添加或更新 AI 供应商 useModel: ${provider.name}`);
    return await modelStore.addOrUpdateAIProvider(provider);
  }

  /**
   * 删除 AI 供应商
   */
  async function deleteAIProvider(providerId: string): Promise<boolean> {
    if (!(await ensureLoaded())) return false;
    return await modelStore.deleteAIProvider(providerId);
  }

  if (autoInit) {
    init();
  }

  return {
    // 状态
    config,
    loading,
    isLoaded,
    errorCode,
    errorMessage,
    // 派生数据
    providers,
    defaultModels,
    providerPriority,
    enableAiMode,
    enableCloudAi,
    // 下载状态
    downloadGroupId,
    isDownloadingModels,
    // 方法
    init,
    getValue,
    setValue,
    resetConfig,
    downloadModel,
    checkModelExist,
    reDownloadModel,
    cancelDownload,
    updateEnableAiMode,
    updateEnableCloudAi,
    addOrUpdateDefaultModel,
    addOrUpdateAIProvider,
    deleteAIProvider,
  };
}

export type UseModelReturn = ReturnType<typeof useModel>;
