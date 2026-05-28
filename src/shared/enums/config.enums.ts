export const THEME_MODE = {
  DARK: "dark",
  LIGHT: "light",
  SYSTEM: "system",
};

export type ThemeMode = (typeof THEME_MODE)[keyof typeof THEME_MODE];

export const LOCALE = {
  EN: "enUS",
  ZH: "zhCN",
};

export type Locale = (typeof LOCALE)[keyof typeof LOCALE];

export const UPDATE_CHANNEL = {
  STABLE: "stable",
  BETA: "beta",
  ALPHA: "alpha",
};

export type UpdateChannel =
  (typeof UPDATE_CHANNEL)[keyof typeof UPDATE_CHANNEL];

export const MODEL_TYPE = {
  TEXT: "text",
  IMAGE: "image",
  AUDIO: "audio",
  VIDEO: "video",
};
export type ModelType = (typeof MODEL_TYPE)[keyof typeof MODEL_TYPE];

export const THEME_COLOR = {
  RED: "red",
  ORANGE: "orange",
  YELLOW: "yellow",
  GREEN: "green",
  CYAN: "cyan",
  BLUE: "blue",
  PURPLE: "purple",
  PINK: "pink",
  BROWN: "brown",
};
export type ThemeColor = (typeof THEME_COLOR)[keyof typeof THEME_COLOR];
