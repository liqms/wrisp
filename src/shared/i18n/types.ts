import { LocaleEnum } from '../enums';

export type Locale = keyof typeof LocaleEnum;

export interface SupportedLocale {
  code: Locale;
  name: string;
  flag: string;
}