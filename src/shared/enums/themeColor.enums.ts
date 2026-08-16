import {
  THEME_MODE,
  ThemeMode,
  THEME_COLOR,
  ThemeColor,
} from "@/shared/enums/config.enums";

// Naive UI 自定义主题配置
export interface ThemeOverrides {
  primaryColor: string; // 主色
  primaryColorHover: string; // 主色悬停
  primaryColorPressed: string; // 主色按下
  primaryColorSuppl: string; // 辅助主色（用于边框、浅色背景）
  backgroundColor: string; // 背景色（用于 Naive UI 的背景覆盖）
}

export const THEME_OVERRIDES: Record<
  ThemeMode,
  Record<ThemeColor, ThemeOverrides>
> = {
  [THEME_MODE.LIGHT]: {
    [THEME_COLOR.RED]: {
      primaryColor: "rgb(233, 49, 71)",
      primaryColorHover: "#ff4d4f",
      primaryColorPressed: "#cf1122",
      primaryColorSuppl: "rgb(233, 49, 71)",
      backgroundColor: "#fcfcfc",
    },
    [THEME_COLOR.ORANGE]: {
      primaryColor: "#ec7500",
      primaryColorHover: "#ff7a00",
      primaryColorPressed: "#c05600",
      primaryColorSuppl: "rgb(236, 117, 0)",
      backgroundColor: "#fcfcfc",
    },
    [THEME_COLOR.YELLOW]: {
      primaryColor: "#e0ac00",
      primaryColorHover: "#ffb800",
      primaryColorPressed: "#c07800",
      primaryColorSuppl: "rgb(224, 172, 0)",
      backgroundColor: "#fcfcfc",
    },
    [THEME_COLOR.GREEN]: {
      primaryColor: "rgb(24, 160, 88)",
      primaryColorHover: "#36ad6a",
      primaryColorPressed: "#0c7a43",
      primaryColorSuppl: "#36ad6a",
      backgroundColor: "#fcfcfc",
    },
    [THEME_COLOR.CYAN]: {
      primaryColor: "#00bfbc",
      primaryColorHover: "#00d9d7",
      primaryColorPressed: "#00a19e",
      primaryColorSuppl: "rgb(0, 191, 188)",
      backgroundColor: "#fcfcfc",
    },
    [THEME_COLOR.BLUE]: {
      primaryColor: "#2d8cff",
      primaryColorHover: "#5ca6ff",
      primaryColorPressed: "#1a6ee0",
      primaryColorSuppl: "rgb(8, 109, 221)",
      backgroundColor: "#fcfcfc",
    },
    [THEME_COLOR.PURPLE]: {
      primaryColor: "#7852ee",
      primaryColorHover: "#9c77ff",
      primaryColorPressed: "#5a31c8",
      primaryColorSuppl: "rgb(120, 82, 238)",
      backgroundColor: "#fcfcfc",
    },
    [THEME_COLOR.PINK]: {
      primaryColor: "#d53984",
      primaryColorHover: "#ff69b4",
      primaryColorPressed: "#a020f0",
      primaryColorSuppl: "rgb(213, 57, 132)",
      backgroundColor: "#fcfcfc",
    },
    [THEME_COLOR.BROWN]: {
      primaryColor: "#a67c52",
      primaryColorHover: "#d2b48c",
      primaryColorPressed: "#8b5e3c",
      primaryColorSuppl: "rgb(166, 124, 82)",
      backgroundColor: "#fcfcfc",
    },
  },
  [THEME_MODE.DARK]: {
    [THEME_COLOR.RED]: {
      primaryColor: "#fb464c",
      primaryColorHover: "#7fe7c4",
      primaryColorPressed: "#5acea7",
      primaryColorSuppl: "rgb(42, 148, 125)",
      backgroundColor: "#1c1c1f",
    },
    [THEME_COLOR.ORANGE]: {
      primaryColor: "#ec7500",
      primaryColorHover: "#ff7a00",
      primaryColorPressed: "#c05600",
      primaryColorSuppl: "rgb(236, 117, 0)",
      backgroundColor: "#1c1c1f",
    },
    [THEME_COLOR.YELLOW]: {
      primaryColor: "#e0ac00",
      primaryColorHover: "#ffb800",
      primaryColorPressed: "#c07800",
      primaryColorSuppl: "rgb(224, 172, 0)",
      backgroundColor: "#1c1c1f",
    },
    [THEME_COLOR.GREEN]: {
      primaryColor: "#63e2b7",
      primaryColorHover: "#7fe7c4",
      primaryColorPressed: "#5acea7",
      primaryColorSuppl: "rgb(42, 148, 125)",
      backgroundColor: "#1c1c1f",
    },
    [THEME_COLOR.CYAN]: {
      primaryColor: "#00bfbc",
      primaryColorHover: "#00d9d7",
      primaryColorPressed: "#00a19e",
      primaryColorSuppl: "rgb(0, 191, 188)",
      backgroundColor: "#1c1c1f",
    },
    [THEME_COLOR.BLUE]: {
      primaryColor: "#086ddd",
      primaryColorHover: "#4098fc",
      primaryColorPressed: "#1060c9",
      primaryColorSuppl: "rgb(8, 109, 221)",
      backgroundColor: "#1c1c1f",
    },
    [THEME_COLOR.PURPLE]: {
      primaryColor: "#7852ee",
      primaryColorHover: "#9c77ff",
      primaryColorPressed: "#5a31c8",
      primaryColorSuppl: "rgb(120, 82, 238)",
      backgroundColor: "#1c1c1f",
    },
    [THEME_COLOR.PINK]: {
      primaryColor: "#d53984",
      primaryColorHover: "#ff69b4",
      primaryColorPressed: "#a020f0",
      primaryColorSuppl: "rgb(213, 57, 132)",
      backgroundColor: "#1c1c1f",
    },
    [THEME_COLOR.BROWN]: {
      primaryColor: "#a67c52",
      primaryColorHover: "#d2b48c",
      primaryColorPressed: "#8b5e3c",
      primaryColorSuppl: "rgb(166, 124, 82)",
      backgroundColor: "#1c1c1f",
    },
  },
};

// 工具函数：根据主题模式和颜色获取主题颜色的主色调配置
export function getThemeOverrides(
  themeMode: ThemeMode,
  color: ThemeColor,
): ThemeOverrides {
  return THEME_OVERRIDES[themeMode][color];
}

export interface ThemeColorOption {
  themeColor: ThemeColor;
  colorHex: string;
}

// 工具函数：获取当前主题模式所有的 ThemeColor 和 PrimaryColor
export function getThemeThemePrimaryColor(
  themeMode: ThemeMode,
): ThemeColorOption[] {
  const themeColors = Object.values(THEME_COLOR) as ThemeColor[];
  return themeColors.map((color) => {
    const overrides = THEME_OVERRIDES[themeMode][color];
    const primaryColor = overrides?.primaryColor ?? "";
    return {
      themeColor: color,
      colorHex: primaryColor,
    };
  });
}

// 工具函数：将颜色值转换为 rgba 格式。兼容 #hex 与 rgb(...) 两种输入
// （Naive UI 的 themeVars 直接返回传入的 primaryColor，可能为 "rgb(24, 160, 88)" 形式）
export function hexToRgb(color: string, alpha: number = 1): string {
  let r: number;
  let g: number;
  let b: number;
  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    r = Number(rgbMatch[1]);
    g = Number(rgbMatch[2]);
    b = Number(rgbMatch[3]);
  } else {
    const bigint = parseInt(color.replace("#", ""), 16);
    r = (bigint >> 16) & 255;
    g = (bigint >> 8) & 255;
    b = bigint & 255;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
