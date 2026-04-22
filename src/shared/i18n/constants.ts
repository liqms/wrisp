import type { SupportedLocale, LocaleValue } from './types';
import { LocaleEnum } from '../enums';

export const SUPPORTED_LOCALES: SupportedLocale[] = [
  { code: LocaleEnum.ZH, name: '简体中文', flag: 'CN' },
  { code: LocaleEnum.EN, name: 'English', flag: 'US' }
];

export const DEFAULT_LOCALE: LocaleValue = LocaleEnum.ZH;
