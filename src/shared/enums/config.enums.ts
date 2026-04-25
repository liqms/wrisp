export const ThemeEnum = {
  DARK: 'dark',
  LIGHT: 'light'
}

export type Theme = keyof typeof ThemeEnum;

export const LocaleEnum = {
  EN: 'enUS',
  ZH: 'zhCN'
}

export type Locale = keyof typeof LocaleEnum;

export const UpdateChannelEnum = {
  STABLE: 'stable',
  BETA: 'beta',
  ALPHA: 'alpha'
}

export type UpdateChannel = keyof typeof UpdateChannelEnum;
