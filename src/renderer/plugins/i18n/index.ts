import { createI18n } from 'vue-i18n';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from '@/shared/i18n/constants';
// 直接导入 shared 目录下的 JSON 文件
import zhCN from '@/shared/i18n/locales/zh-CN.json';
import enUS from '@/shared/i18n/locales/en-US.json';
import jaJP from '@/shared/i18n/locales/ja-JP.json';

// 从 localStorage 读取保存的语言
const savedLocale = (localStorage.getItem('locale') as Locale) || DEFAULT_LOCALE;

export const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: DEFAULT_LOCALE,
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
    'ja-JP': jaJP
  }
});

// 语言切换方法
export const setLocale = (locale: Locale) => {
  i18n.global.locale.value = locale;
  localStorage.setItem('locale', locale);
  // 通知主进程更新菜单
  window.electronAPI?.setLocale?.(locale);
};

export const getCurrentLocale = () => i18n.global.locale.value;