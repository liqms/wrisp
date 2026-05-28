import { createI18n, type I18n } from "vue-i18n";
import { unref, type WritableComputedRef } from "vue";
import { Locale, LOCALE } from "@/shared/enums";
import { logger } from "@/renderer/utils/logger.utils";

// 静态导入语言文件
import zhCNMessages from "@/shared/i18n/locales/zhCN";
import enUSMessages from "@/shared/i18n/locales/enUS";
import { ApiResponse, SystemInfo } from "@/shared/types";

// 支持的语言列表（统一使用 zhCN/enUS 格式）
const supportedLocales = [LOCALE.ZH, LOCALE.EN];

// 语言消息映射
const localeMessages: Record<string, Record<string, any>> = {
  [LOCALE.ZH]: zhCNMessages,
  [LOCALE.EN]: enUSMessages,
};

/**
 * 获取统一的查找键值
 * @param locale 语言代码（zhCN/enUS 格式）
 * @returns 有效的语言键值，无效时返回默认值 zhCN
 */
export const getLookupKey = (locale: string): string => {
  return supportedLocales.includes(locale) ? locale : LOCALE.EN;
};

/**
 * 获取默认语言，调用后端接口获取系统语言和配置中的语言设置
 * @returns 默认语言键值（zhCN）
 */
const getDefaultLocale = async (): Promise<string> => {
  let systemLocale: string | undefined;
  let configLocale: string | undefined;
  // 从系统设置中获取语言
  try {
    const systemInfoRes =
      (await window.electronAPI.system.getSystemInfo()) as ApiResponse<SystemInfo>;
    const systemInfo = systemInfoRes.data as SystemInfo;
    systemLocale = systemInfo?.locale;
  } catch (error) {
    logger.error("获取系统语言失败", { error });
  }
  // 从配置文件中获取语言
  try {
    const configRes = (await window.electronAPI.config.getValue(
      "general.locale",
    )) as ApiResponse<string>;
    configLocale = configRes?.data as string | undefined;
  } catch (error) {
    logger.error("获取配置语言失败", { error });
  }
  // 返回默认语言（优先使用配置语言, 系统语言次之，最后使用默认值 zhCN）
  return configLocale || systemLocale || LOCALE.ZH;
};

// 创建 i18n 实例（使用默认语言，避免在 Pinia 初始化前调用 store）
export const i18n: I18n = createI18n({
  // 组合式 API
  legacy: false,
  // 初始化默认语言（使用静态默认值，避免在 Pinia 初始化前调用 store）
  locale: LOCALE.EN,
  // 回退语言
  fallbackLocale: LOCALE.EN,
  // 语言消息映射
  messages: localeMessages,
  // 支持的语言列表
  availableLocales: supportedLocales,
  // 启用全局注入，使 useI18n() 返回响应式的 t 函数
  globalInjection: true,
  // 禁用语言代码规范化，确保使用完整的语言代码
  allowComposition: true,
  // 禁用缺失语言警告
  missingWarn: true,
  // 禁用回退语言警告
  fallbackWarn: true,
});

/**
 * 设置语言，并保存到配置文件
 * 注意：直接通过 IPC 保存配置，避免通过 useConfig → store 的循环依赖
 * @param locale 目标语言（zhCN/enUS 格式）
 */
export const setLocale = async (locale: Locale): Promise<void> => {
  try {
    // 获取统一的查找键值
    const lookupKey = getLookupKey(locale);
    // i18n.global.locale 返回的是响应式对象，需要用 unref 获取实际值
    const currentLocale = unref(i18n.global.locale) as string;

    // 如果当前语言与目标语言相同，无需切换
    if (currentLocale === lookupKey) {
      logger.info(`当前语言与目标语言相同，无需切换: ${locale}`);
      return;
    }

    // 设置当前语言（使用统一的查找键值）
    (i18n.global.locale as WritableComputedRef<string>).value = lookupKey;
    logger.info(`切换语言: ${currentLocale} -> ${lookupKey}`);

    // 直接通过 IPC 保存到配置文件，避免通过 useConfig → store 的循环依赖
    const saveResult = (await window.electronAPI.config.setValue(
      "general.locale",
      lookupKey,
    )) as ApiResponse<void>;
    if (saveResult.success) {
      logger.info("语言配置已保存");
    } else {
      logger.error("语言配置保存失败", { code: saveResult.code });
    }
  } catch (error) {
    logger.error("设置语言失败:", { error });
  }
};

/**
 * 初始化 i18n（应用启动时调用）
 * @param initialLocale 初始语言（可选，默认为中文）
 */
export const initI18n = async (initialLocale?: string): Promise<void> => {
  try {
    // 获取默认语言
    const defaultLocale = await getDefaultLocale();
    // 使用传入的初始语言或默认语言
    const targetLocale = initialLocale || defaultLocale;
    const lookupKey = getLookupKey(targetLocale);

    // 设置当前语言（i18n.global.locale 是 WritableComputedRef，需要使用 .value 来赋值）
    (i18n.global.locale as WritableComputedRef<string>).value = lookupKey;
    logger.info(`i18n 初始化完成，当前语言: ${lookupKey}`);
  } catch (error) {
    logger.warn("i18n 初始化失败，使用默认语言:", { error });
    (i18n.global.locale as WritableComputedRef<string>).value = LOCALE.EN;
  }
};

/**
 * 非组件环境下的翻译函数
 * @param key 翻译键
 * @param params 叿换参数
 * @returns 翻译后的字符串
 */
export const t = (key: string, params?: Record<string, any>): string => {
  try {
    // 使用类型断言避免 TypeScript 类型错误
    const translateFn = i18n.global.t as unknown as (
      key: string,
      params?: Record<string, any>,
    ) => string;
    return translateFn(key, params);
  } catch (error) {
    logger.error("翻译失败:", { error });
    return key;
  }
};
