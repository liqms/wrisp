import { createI18n, type I18n } from 'vue-i18n';
import { type LocaleValue } from '@/shared/i18n/types';
import { LocaleEnum } from '@/shared/enums';
import { logger } from '@/renderer/utils/logger.utils';

// 语言代码映射：将各种格式映射为统一的查找键值
const localeMapping: Record<string, string> = {
  // 标准格式映射到统一格式
  'zh-CN': 'zhCN',
  'en-US': 'enUS',
  // 统一格式（主要查找键值）
  'zhCN': 'zhCN',
  'enUS': 'enUS'
};

// 获取统一的查找键值（避免 vue-i18n 语言代码规范化）
const getLookupKey = (locale: string): string => {
  return localeMapping[locale] || 'zhCN';
};

// 获取文件使用的语言代码（用于加载语言文件）
const getFileLocale = (locale: string): LocaleValue => {
  const lookupKey = getLookupKey(locale);
  // 将 zhCN 转换为 zh-CN，enUS 转换为 en-US
  if (lookupKey === 'zhCN') return LocaleEnum.ZH;
  if (lookupKey === 'enUS') return LocaleEnum.EN;
  return LocaleEnum.ZH;
};

// 动态导入语言文件，支持按需加载
const loadLocaleMessages = async (locale: LocaleValue): Promise<Record<string, any>> => {
  try {
    const fileLocale = getFileLocale(locale);
    const messages = await import(`@/shared/i18n/locales/${fileLocale}.json`);
    return messages.default || messages;
  } catch (error) {
    logger.warn(`无法加载语言文件 ${locale}，使用默认语言`, { error });
    // 回退到默认语言
    const fallback = await import(`@/shared/i18n/locales/${LocaleEnum.ZH}.json`);
    return fallback.default || fallback;
  }
};

// 创建 i18n 实例
export const i18n: I18n = createI18n({
  legacy: false,
  locale: 'zhCN',
  fallbackLocale: 'zhCN',
  messages: {},
  // 禁用语言代码规范化，确保使用完整的语言代码
  allowComposition: true,
  missingWarn: false,
  fallbackWarn: false
});


// 语言文件缓存
const loadedLocales = new Set<LocaleValue>();

/**
 * 设置语言并加载对应的语言文件
 */
export const setLocale = async (locale: LocaleValue): Promise<void> => {
  try {
    // 获取统一的查找键值（避免 vue-i18n 语言代码规范化）
    const lookupKey = getLookupKey(locale);
    const currentLocale = i18n.global.locale as LocaleValue;

    // 如果当前语言与目标语言相同，无需加载
    if (currentLocale === locale) {
      logger.info(`当前语言与目标语言相同，无需加载语言文件: ${locale}`);
      return;
    }

    const fileLocale = getFileLocale(locale);
    
    // 如果语言文件未加载，先加载
    if (!loadedLocales.has(lookupKey)) {
      const messages = await loadLocaleMessages(fileLocale);
      
      // 注册到统一的查找键值，确保 vue-i18n 能正确查找
      i18n.global.setLocaleMessage(lookupKey, messages);
      
      loadedLocales.add(lookupKey);
    }

    // 设置当前语言（使用统一的查找键值）
    i18n.global.locale = lookupKey;

  } catch (error) {
    logger.error('设置语言失败:', { error });
  }
};

/**
 * 初始化 i18n（应用启动时调用）
 */
export const initI18n = async (): Promise<void> => {
  try {
    // 加载中文语言文件，设置为默认语言
    const zhLookupKey = getLookupKey(LocaleEnum.ZH);
    if (!loadedLocales.has(zhLookupKey)) {
      const messages = await loadLocaleMessages(LocaleEnum.ZH);
      
      // 注册到统一的查找键值
      i18n.global.setLocaleMessage(zhLookupKey, messages);
      
      loadedLocales.add(zhLookupKey);
    }
    
    // 设置当前语言为中文（默认语言）
    i18n.global.locale = zhLookupKey;

  } catch (error) {
    logger.warn('i18n 初始化失败，使用默认语言:', { error });

    // 确保至少加载默认语言
    const zhLookupKey = getLookupKey(LocaleEnum.ZH);
    if (!loadedLocales.has(zhLookupKey)) {
      const messages = await loadLocaleMessages(LocaleEnum.ZH);
      
      i18n.global.setLocaleMessage(zhLookupKey, messages);
      loadedLocales.add(zhLookupKey);
    }

    i18n.global.locale = zhLookupKey;
  }
};
