import { LocaleEnum } from '../enums';

export type LocaleValue = typeof LocaleEnum[keyof typeof LocaleEnum];

export interface SupportedLocale {
  code: LocaleValue;
  name: string;
  flag: string;
}