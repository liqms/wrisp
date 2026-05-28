// src/renderer/composables/useTheme.ts

import { computed, watch, onMounted } from "vue";
import { useConfigStore } from "@/renderer/store/config.store";
import {
  THEME_MODE,
  ThemeMode,
  THEME_COLOR,
  ThemeColor,
  THEME_OVERRIDES,
  ThemeOverrides,
} from "@/shared/enums";

export function useTheme() {
  const configStore = useConfigStore();

  // 当前实际显示模式（'light' 或 'dark'）
  const activeMode = computed<ThemeMode>(() => {
    const themeMode =
      configStore.config?.general?.themeMode || THEME_MODE.SYSTEM;
    if (themeMode === THEME_MODE.SYSTEM) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? THEME_MODE.DARK
        : THEME_MODE.LIGHT;
    }
    return themeMode;
  });

  // 当前主题色
  const themeColor = computed<ThemeColor>(() => {
    return configStore.config?.general?.themeColor || THEME_COLOR.GREEN;
  });

  // 获取当前模式下的主题色值（用于 Naive UI）
  const currentThemeColors = computed(() => {
    const themeSet = THEME_OVERRIDES[activeMode.value][themeColor.value];
    if (!themeSet) return THEME_OVERRIDES[activeMode.value][THEME_COLOR.GREEN];
    return themeSet;
  });

  // Naive UI 主题覆盖配置
  const naiveThemeOverrides = computed(() => {
    const colors = currentThemeColors.value;
    return {
      common: {
        primaryColor: colors.primaryColor,
        primaryColorHover: colors.primaryColorHover,
        primaryColorPressed: colors.primaryColorPressed,
        primaryColorSuppl: colors.primaryColorSuppl,
        backgroundColor: colors.backgroundColor,
      },
    };
  });

  // 应用 CSS 变量（用于自定义组件）
  const applyCssVariables = (mode: ThemeMode, colors: ThemeOverrides) => {
    const root = document.documentElement;
    root.setAttribute("data-theme", mode);
    root.setAttribute("data-color", themeColor.value);

    // 设置 CSS 变量
    root.style.setProperty("--color-primary", colors.primaryColor);
    root.style.setProperty("--color-primary-hover", colors.primaryColorHover);
    root.style.setProperty(
      "--color-primary-pressed",
      colors.primaryColorPressed,
    );
    root.style.setProperty("--color-primary-suppl", colors.primaryColorSuppl);
    root.style.setProperty("--bg-primary", colors.backgroundColor);
  };

  // 监听变化并应用
  watch([activeMode, themeColor], () => {
    const colors = currentThemeColors.value;
    applyCssVariables(activeMode.value, colors);
  });

  // 监听系统主题变化（仅在 themeMode === 'system' 时）
  let systemThemeMedia: MediaQueryList | null = null;
  const handleSystemChange = (e: MediaQueryListEvent) => {
    if (configStore.config?.general?.themeMode === THEME_MODE.SYSTEM) {
      const newMode = e.matches ? THEME_MODE.DARK : THEME_MODE.LIGHT;
      applyCssVariables(newMode, currentThemeColors.value);
    }
  };

  onMounted(() => {
    // 初始化
    const colors = currentThemeColors.value;
    applyCssVariables(activeMode.value, colors);

    // 监听系统主题
    systemThemeMedia = window.matchMedia("(prefers-color-scheme: dark)");
    systemThemeMedia.addEventListener("change", handleSystemChange);
  });

  return {
    activeMode,
    themeColor,
    currentThemeColors,
    naiveThemeOverrides,
  };
}
