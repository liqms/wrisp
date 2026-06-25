import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { ApiResponse } from "@/shared/types";
import type { ModelConfig, ModelType, DefaultModel, AIProvider } from "@/shared/types/model.types";
import { ErrorCode } from "@/shared/enums";
import { getErrorMessage } from "@/renderer/utils/error.utils";
import { logger } from "@/renderer/utils/logger.utils";

export const useModelStore = defineStore("model", () => {
    // 状态
    const config = ref<ModelConfig | null>(null);
    const loading = ref(false);
    const errorCode = ref<ErrorCode | null>(null);
    const errorMessage = ref<string | null>(null);

    // 计算属性
    const isLoaded = computed(() => config.value !== null);
    const hasError = computed(() => errorCode.value !== null);
    const isReady = computed(() => !loading.value && !hasError.value);

    /**
     * 获取模型配置
     */
    const fetchConfig = async (): Promise<boolean> => {
        loading.value = true;
        errorCode.value = null;
        errorMessage.value = null;

        try {
            const response =
                (await window.electronAPI.model.getConfig()) as ApiResponse<ModelConfig>;

            if (response.success && response.data) {
                config.value = response.data as ModelConfig;
                return true;
            } else {
                errorCode.value = response.code;
                errorMessage.value = getErrorMessage(response.code);
                return false;
            }
        } catch (error) {
            errorCode.value = ErrorCode.MODEL_GET_CONFIG_FAILED;
            errorMessage.value = getErrorMessage(errorCode.value);
            return false;
        } finally {
            loading.value = false;
        }
    };

    /**
     * 获取特定模型配置项的值
     */
    const getConfigValue = async (keyPath: string): Promise<any> => {
        try {
            const response = (await window.electronAPI.model.getValue(
                keyPath,
            )) as ApiResponse<any>;

            if (response.success) {
                return response.data;
            } else {
                errorCode.value = response.code;
                errorMessage.value = getErrorMessage(response.code);
                return null;
            }
        } catch (error) {
            errorCode.value = ErrorCode.MODEL_GET_VALUE_FAILED;
            errorMessage.value = getErrorMessage(errorCode.value);
            return null;
        }
    };

    /**
     * 设置特定模型配置项的值
     */
    const setConfigValue = async (
        keyPath: string,
        value: any,
    ): Promise<boolean> => {
        try {
            // 深拷贝以剥离 Vue 响应式 Proxy，确保 IPC 序列化正常
            const rawValue = JSON.parse(JSON.stringify(value));
            const response = (await window.electronAPI.model.setValue(
                keyPath,
                rawValue,
            )) as ApiResponse<void>;

            if (response.success) {
                // 更新本地配置状态
                if (config.value) {
                    const updateNestedValue = (obj: any, path: string, val: any): any => {
                        const keys = path.split(".");
                        const currentKey = keys[0];
                        if (keys.length === 1) {
                            return { ...obj, [currentKey]: val };
                        }
                        return {
                            ...obj,
                            [currentKey]: updateNestedValue(
                                obj[currentKey] || {},
                                keys.slice(1).join("."),
                                val,
                            ),
                        };
                    };
                    config.value = updateNestedValue(config.value, keyPath, value);
                }
                return true;
            } else {
                errorCode.value = response.code;
                errorMessage.value = getErrorMessage(response.code);
                return false;
            }
        } catch (error) {
            errorCode.value = ErrorCode.MODEL_SET_VALUE_FAILED;
            errorMessage.value = getErrorMessage(errorCode.value);
            return false;
        }
    };

    /**
     * 重置模型配置为默认值
     */
    const resetModelConfig = async (): Promise<boolean> => {
        loading.value = true;
        errorCode.value = null;
        errorMessage.value = null;

        try {
            const response =
                (await window.electronAPI.model.resetConfig()) as ApiResponse<void>;

            if (response.success) {
                config.value = null;
                return true;
            } else {
                errorCode.value = response.code;
                errorMessage.value = getErrorMessage(response.code);
                return false;
            }
        } catch (error) {
            errorCode.value = ErrorCode.MODEL_RESET_CONFIG_FAILED;
            errorMessage.value = getErrorMessage(errorCode.value);
            return false;
        } finally {
            loading.value = false;
        }
    };

    /**
     * 下载模型文件
     */
    const downloadModel = async (type: ModelType): Promise<string | null> => {
        loading.value = true;
        errorCode.value = null;
        errorMessage.value = null;

        try {
            const response = (await window.electronAPI.model.downloadModel(
                type,
            )) as ApiResponse<string>;

            if (response.success) {
                return response.data as string;
            } else {
                errorCode.value = response.code;
                errorMessage.value = getErrorMessage(response.code);
                return null;
            }
        } catch (error) {
            errorCode.value = ErrorCode.MODEL_DOWNLOAD_FAILED;
            errorMessage.value = getErrorMessage(errorCode.value);
            return null;
        } finally {
            loading.value = false;
        }
    };

    /**
     * 检查各模型文件是否已下载
     */
    const checkModelExist = async (): Promise<Record<string, boolean> | null> => {
        try {
            const response = (await window.electronAPI.model.checkModelExist()) as ApiResponse<Record<string, boolean>>;

            if (response.success && response.data !== undefined) {
                return response.data as Record<string, boolean>;
            } else {
                errorCode.value = response.code;
                errorMessage.value = getErrorMessage(response.code);
                return null;
            }
        } catch (error) {
            errorCode.value = ErrorCode.MODEL_CHECK_EXIST_FAILED;
            errorMessage.value = getErrorMessage(errorCode.value);
            return null;
        }
    };

    /**
     * 重新下载模型文件
     */
    const reDownloadModel = async (type: ModelType): Promise<boolean> => {
        loading.value = true;
        errorCode.value = null;
        errorMessage.value = null;

        try {
            const response = (await window.electronAPI.model.reDownloadModel(
                type,
            )) as ApiResponse<void>;

            if (response.success) {
                return true;
            } else {
                errorCode.value = response.code;
                errorMessage.value = getErrorMessage(response.code);
                return false;
            }
        } catch (error) {
            errorCode.value = ErrorCode.MODEL_REDOWNLOAD_FAILED;
            errorMessage.value = getErrorMessage(errorCode.value);
            return false;
        } finally {
            loading.value = false;
        }
    };

    /**
     * 取消模型下载
     */
    const cancelDownload = async (groupId: string): Promise<boolean> => {
        loading.value = true;
        errorCode.value = null;
        errorMessage.value = null;

        try {
            const response = (await window.electronAPI.model.cancelDownload(
                groupId,
            )) as ApiResponse<void>;

            if (response.success) {
                return true;
            } else {
                errorCode.value = response.code;
                errorMessage.value = getErrorMessage(response.code);
                return false;
            }
        } catch (error) {
            errorCode.value = ErrorCode.MODEL_CANCEL_DOWNLOAD_FAILED;
            errorMessage.value = getErrorMessage(errorCode.value);
            return false;
        } finally {
            loading.value = false;
        }
    };

    /**
     * 更新默认模型列表（全量替换）
     */
    const addOrUpdateDefaultModel = async (models: DefaultModel[]): Promise<boolean> => {
        try {
            // 深拷贝以剥离 Vue 响应式 Proxy，确保 IPC 序列化正常
            const rawModels = JSON.parse(JSON.stringify(models));
            const response = (await window.electronAPI.model.setValue(
                "defaultModels",
                rawModels,
            )) as ApiResponse<void>;

            if (response.success) {
                if (config.value) {
                    config.value = { ...config.value, defaultModels: models };
                }
                return true;
            } else {
                errorCode.value = response.code;
                errorMessage.value = getErrorMessage(response.code);
                return false;
            }
        } catch (error) {
            errorCode.value = ErrorCode.MODEL_SET_VALUE_FAILED;
            errorMessage.value = getErrorMessage(errorCode.value);
            return false;
        }
    };

    /**
     * 添加或更新 AI 供应商
     * 根据 id 匹配，存在则更新，不存在则追加
     */
    const addOrUpdateAIProvider = async (provider: AIProvider): Promise<boolean> => {
        logger.debug(`添加或更新 AI 供应商 store: ${provider.name}`);

        if (!config.value) return false;
        try {
            const list = [...config.value.aiProviders];
            const index = list.findIndex((p) => p.id === provider.id);
            if (index >= 0) {
                list[index] = provider;
            } else {
                list.push(provider);
            }
            // 深拷贝以剥离 Vue 响应式 Proxy，确保 IPC 序列化正常
            const rawList = JSON.parse(JSON.stringify(list));
            const response = (await window.electronAPI.model.setValue(
                "aiProviders",
                rawList,
            )) as ApiResponse<void>;

            if (response.success) {
                config.value = { ...config.value, aiProviders: list };
                // 通知后端刷新 LLM 网关配置
                window.electronAPI.ai.refreshConfig().catch((e: unknown) =>
                    logger.error("刷新 AI 配置失败", { error: e }),
                );
                return true;
            } else {
                errorCode.value = response.code;
                errorMessage.value = getErrorMessage(response.code);
                return false;
            }
        } catch (error) {
            errorCode.value = ErrorCode.MODEL_SET_VALUE_FAILED;
            errorMessage.value = getErrorMessage(ErrorCode.MODEL_SET_VALUE_FAILED);
            return false;
        }
    };

    /**
     * 删除 AI 供应商
     * 根据 id 匹配删除
     */
    const deleteAIProvider = async (providerId: string): Promise<boolean> => {
        if (!config.value) return false;
        try {
            const list = [...config.value.aiProviders];
            const index = list.findIndex((p) => p.id === providerId);
            if (index === -1) return true;

            list.splice(index, 1);

            // 深拷贝以剥离 Vue 响应式 Proxy，确保 IPC 序列化正常
            const rawList = JSON.parse(JSON.stringify(list));
            const response = (await window.electronAPI.model.setValue(
                "aiProviders",
                rawList,
            )) as ApiResponse<void>;

            if (response.success) {
                config.value = { ...config.value, aiProviders: list };
                // 通知后端刷新 LLM 网关配置
                window.electronAPI.ai.refreshConfig().catch((e: unknown) =>
                    logger.error("刷新 AI 配置失败", { error: e }),
                );
                return true;
            } else {
                errorCode.value = response.code;
                errorMessage.value = getErrorMessage(response.code);
                return false;
            }
        } catch (error) {
            errorCode.value = ErrorCode.MODEL_SET_VALUE_FAILED;
            errorMessage.value = getErrorMessage(ErrorCode.MODEL_SET_VALUE_FAILED);
            return false;
        }
    };

    return {
        // 状态
        config,
        loading,
        errorCode,
        errorMessage,
        // 计算属性
        isLoaded,
        hasError,
        isReady,
        // 方法
        fetchConfig,
        getConfigValue,
        setConfigValue,
        resetModelConfig,
        downloadModel,
        checkModelExist,
        reDownloadModel,
        cancelDownload,
        addOrUpdateDefaultModel,
        addOrUpdateAIProvider,
        deleteAIProvider,
    };
});
