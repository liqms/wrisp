import type { SupportedLocale, Locale } from './types';

export const SUPPORTED_LOCALES: SupportedLocale[] = [
  { code: 'ZH', name: '简体中文', flag: 'CN' },
  { code: 'EN', name: 'English', flag: 'US' },
  { code: 'JA', name: '日本語', flag: 'JP' }
];

export const DEFAULT_LOCALE: Locale = 'ZH';
