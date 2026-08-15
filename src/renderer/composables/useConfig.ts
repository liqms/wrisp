import { computed, watch } from "vue";
import { useConfigStore } from "@/renderer/store/config.store";
import type { AppConfig } from "@/shared/types";
import {
  THEME_MODE,
  LOCALE,
  THEME_COLOR,
  ErrorCode,
  ThemeMode,
  PROFESSION,
} from "@/shared/enums";
import { logger } from "@/renderer/utils/logger.utils";
import { useFrontendNotification } from "@/renderer/composables/useNotification";
import { t as i18nT } from "@/renderer/plugins/i18n";

interface UseConfigOptions {
  /** 是否自动初始化配置 */
  autoInit?: boolean;
  /** 初始化失败时的重试次数 */
  retryCount?: number;
  /** 重试间隔（毫秒） */
  retryDelay?: number;
}

/**
 * 配置相关的组合函数
 */
export function useConfig(options: UseConfigOptions = {}) {
  const { autoInit = true, retryCount = 3, retryDelay = 1000 } = options;
  const configStore = useConfigStore();
  const t = i18nT;
  const notification = useFrontendNotification({
    title: "",
    content: "",
  });

  // 响应式状态
  const config = computed(() => configStore.config);
  const loading = computed(() => configStore.loading);
  const isLoaded = computed(() => configStore.isLoaded);

  const errorCode = computed(() => configStore.errorCode);
  const errorMessage = computed(() => configStore.errorMessage);

  // 通用配置
  const general = computed(() => config.value?.general ?? null);
  const currentProjectId = computed(() => config.value?.currentProjectId ?? "");
  const workspace = computed(() => config.value?.workspace ?? "");



  // 主题相关
  const themeMode = computed(
    () => general.value?.themeMode ?? THEME_MODE.LIGHT,
  );
  const themeColor = computed(
    () => general.value?.themeColor ?? THEME_COLOR.GREEN,
  );

  // 用户信息
  const userInfo = computed(() => config.value?.userInfo ?? null);
  const isAuthenticated = computed(() => {
    return !!(userInfo.value?.token && userInfo.value?.token.length > 0);
  });

  const hasProfile = computed(() => {
    return !!(
      userInfo.value?.nickname ||
      userInfo.value?.avatar ||
      userInfo.value?.bio
    );
  });

  const registrationDays = computed(() => {
    if (!userInfo.value?.registrationDate) return 0;
    const regDate = new Date(userInfo.value.registrationDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - regDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  });

  // 多语言相关
  const locale = computed(() => general.value?.locale ?? LOCALE.ZH);

  // 职业（决定 Slash Menu 展示的模板）
  const profession = computed(() => {
    return userInfo.value?.preferences?.profession ?? PROFESSION.PM;
  });

  // 版本和升级相关
  const version = computed(() => config.value?.version ?? "0.1.0");

  const shortcuts = computed(() => config.value?.shortcuts ?? []);

  /**
   * 带重试机制的初始化配置
   */
  async function init(): Promise<boolean> {
    if (configStore.isLoaded) return true;

    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        await configStore.fetchConfig();
        if (configStore.isLoaded) return true;

        if (attempt < retryCount) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      } catch (error) {
        logger.warn(`配置初始化第 ${attempt} 次尝试失败`, { error, attempt });
        if (attempt === retryCount) {
          logger.error("配置初始化失败，已达到最大重试次数", { retryCount });
          return false;
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    return false;
  }

  /**
   * 确保配置已加载
   */
  async function ensureLoaded(): Promise<boolean> {
    if (configStore.isLoaded) return true;
    return await init();
  }

  /**
   * 获取特定配置项的值
   */
  async function getValue<T = any>(keyPath: string): Promise<T | null> {
    if (!(await ensureLoaded())) return null;

    try {
      return await configStore.getConfigValue(keyPath);
    } catch (error) {
      logger.error(`获取配置项 ${keyPath} 失败`, { keyPath, error });
      return null;
    }
  }

  /**
   * 设置特定配置项的值
   */
  async function setValue<T = any>(
    keyPath: string,
    value: T,
  ): Promise<boolean> {
    if (!(await ensureLoaded())) return false;

    try {
      return await configStore.setConfigValue(keyPath, value);
    } catch (error) {
      logger.error(`设置配置项 ${keyPath} 失败`, { keyPath, value, error });
      return false;
    }
  }

  /**
   * 更新主题
   */
  async function updateThemeMode(newThemeMode: ThemeMode): Promise<boolean> {
    // 判断新主题是否与当前主题相同，相同则直接返回
    if (newThemeMode === themeMode.value) return true;
    const result = await setValue("general.themeMode", newThemeMode);
    if (!result) {
      const errorCode = ErrorCode.CONFIG_UPDATE_FAILED;
      configStore.setError(errorCode, t("config.themeUpdatedContent"));
      notification.error(
        t("ERROR.CATEGORY.CONFIG"),
        t("config.themeUpdatedContent"),
      );
    }
    return result;
  }

  /**
   * 更新语言
   * @param newLocale 目标语言（zhCN/enUS 格式）
   */
  async function updateLocale(newLocale: string): Promise<boolean> {
    return await setValue("general.locale", newLocale);
  }

  /**
   * 更新主题颜色
   */
  async function updateThemeColor(newColor: string): Promise<boolean> {
    return await setValue("general.themeColor", newColor);
  }

  /**
   * 更新当前工作ID
   */
  async function updateCurrentProjectId(newId: string): Promise<boolean> {
    // 判断新当前项目ID是否与当前ID相同，相同则直接返回
    if (newId === currentProjectId.value) return true;
    return await setValue("currentProjectId", newId);
  }

  /**
   * 更新工作目录
   */
  async function updateWorkspace(newWorkspace: string): Promise<boolean> {
    // 判断新工作目录是否与当前目录相同，相同则直接返回
    if (newWorkspace === workspace.value) return true;
    return await configStore.setWorkspace(newWorkspace);
  }

  /**
   * 更新用户nickname
   */
  async function updateNickname(newNickname: string): Promise<boolean> {
    // 判断新nickname是否与当前nickname相同，相同则直接返回
    if (newNickname === userInfo.value?.nickname) return true;
    return await setValue("userInfo.nickname", newNickname);
  }

  /**
   * 更新用户avatar
   */
  async function updateAvatar(newAvatar: string): Promise<boolean> {
    // 判断新avatar是否与当前avatar相同，相同则直接返回
    if (newAvatar === userInfo.value?.avatar) return true;
    return await setValue("userInfo.avatar", newAvatar);
  }

  /**
   * 更新用户bio
   */
  async function updateBio(newBio: string): Promise<boolean> {
    // 判断新bio是否与当前bio相同，相同则直接返回
    if (newBio === userInfo.value?.bio) return true;
    return await setValue("userInfo.bio", newBio);
  }

  /**
   * 更新是否首次启动
   */
  async function updateIsFirstLaunch(
    newIsFirstLaunch: boolean,
  ): Promise<boolean> {
    return await setValue("isFirstLaunch", newIsFirstLaunch);
  }

  /**
   * 更新是否更新后首次启动
   */
  async function updateIsUpdateLaunch(
    newIsUpdateLaunch: boolean,
  ): Promise<boolean> {
    return await setValue("isUpdateLaunch", newIsUpdateLaunch);
  }

  async function updateShortcuts(
    newShortcuts: { id: string; keys: string }[],
  ): Promise<boolean> {
    return await setValue("shortcuts", newShortcuts);
  }

  /**
   * 重置配置
   */
  async function reset(): Promise<boolean> {
    try {
      const result = await configStore.resetConfig();
      if (result) {
        // 重置后重新初始化
        await init();
      }
      return result;
    } catch (error) {
      logger.error("重置配置失败", { error });
      return false;
    }
  }

  /**
   * 清空错误信息
   */
  function clearError(): void {
    configStore.clearError();
  }

  /**
   * 监听配置变化
   */
  function watchConfig<T = any>(
    selector: (config: AppConfig | null) => T,
    callback: (newValue: T, oldValue: T) => void,
    options?: { immediate?: boolean; deep?: boolean },
  ) {
    return watch(
      () => selector(config.value),
      (newValue, oldValue) => {
        if (newValue !== oldValue) {
          callback(newValue as T, oldValue as T);
        }
      },
      { ...options, deep: options?.deep ?? false },
    );
  }

  /**
   * 监听特定配置项变化
   */
  function watchConfigValue<T = any>(
    keyPath: string,
    callback: (newValue: T, oldValue: T) => void,
    options?: { immediate?: boolean },
  ) {
    const getNestedValue = (obj: any, path: string): T | undefined => {
      return path.split(".").reduce((current, key) => current?.[key], obj);
    };

    return watch(
      () => getNestedValue(config.value, keyPath),
      (newValue, oldValue) => {
        if (newValue !== oldValue) {
          callback(newValue as T, oldValue as T);
        }
      },
      options,
    );
  }

  /**
   * 监听配置加载状态
   */
  function watchLoaded(
    callback: (loaded: boolean) => void,
    options?: { immediate?: boolean },
  ) {
    return watch(
      () => configStore.isLoaded,
      (loaded) => callback(loaded),
      options,
    );
  }

  // 自动初始化
  if (autoInit) {
    init().catch((error) => {
      logger.warn("自动初始化配置失败", { error });
    });
  }

  return {
    // 状态
    config,
    loading,
    isLoaded,
    errorCode,
    errorMessage,

    // 计算属性
    general,
    userInfo,
    isAuthenticated,
    hasProfile,
    registrationDays,
    workspace,
    currentProjectId,
    themeMode,
    themeColor,
    locale,
    profession,
    version,
    shortcuts,

    // 核心方法
    init,
    ensureLoaded,
    getValue,
    setValue,
    updateThemeMode,
    updateThemeColor,
    updateLocale,
    updateNickname,
    updateAvatar,
    updateBio,
    updateWorkspace,
    updateCurrentProjectId,
    updateIsFirstLaunch,
    updateIsUpdateLaunch,
    updateShortcuts,
    reset,
    clearError,

    // 监听器
    watchConfig,
    watchConfigValue,
    watchLoaded,
  };
}

/**
 * 配置相关的类型导出
 */
export type UseConfigReturn = ReturnType<typeof useConfig>;
