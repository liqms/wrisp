export const ThemeEnum = {
  DARK: 'dark',
  LIGHT: 'light'
}

export type Theme = keyof typeof ThemeEnum;

export const LocaleEnum = {
  EN: 'en-US',
  ZH: 'zh-CN'
}

export type Locale = keyof typeof LocaleEnum;

export const UpdateChannelEnum = {
  STABLE: 'stable',
  BETA: 'beta',
  ALPHA: 'alpha'
}

export type UpdateChannel = keyof typeof UpdateChannelEnum;
