import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useConfigStore } from "./config.store";
import type { KeymapItem } from "@/shared/types";

/** 快捷键动作标识 */
export type ShortcutActionId = "settings" | "search";

/** 可配置快捷键项（含默认值 + i18n 标签 key） */
export interface ShortcutItem {
  id: ShortcutActionId;
  labelKey: string;
  defaultKeys: string;
  currentKeys: string;
}

/**
 * 默认快捷键列表。
 * 只包含应用真实拥有对应动作的快捷键：
 * - settings：打开设置弹窗
 * - search：打开全局搜索弹窗
 * （capture 功能已移除；copy/paste 为系统原生能力，不应在应用内重映射）
 */
export const DEFAULT_SHORTCUTS: ShortcutItem[] = [
  {
    id: "settings",
    labelKey: "SETTINGS.SHORTCUT_SETTINGS.SETTINGS",
    defaultKeys: "Ctrl+,",
    currentKeys: "Ctrl+,",
  },
  {
    id: "search",
    labelKey: "SETTINGS.SHORTCUT_SETTINGS.SEARCH",
    defaultKeys: "Ctrl+Shift+F",
    currentKeys: "Ctrl+Shift+F",
  },
];

/**
 * 将已保存的快捷键配置与默认值合并。
 * 已保存的项按 id 覆盖默认值，未保存的项回退到默认值。
 */
export function resolveShortcuts(
  saved: KeymapItem[] | undefined,
  defaults: ShortcutItem[] = DEFAULT_SHORTCUTS,
): ShortcutItem[] {
  const savedMap = new Map<string, string>(
    (saved ?? []).map((s) => [s.id, s.keys]),
  );
  return defaults.map((d) => ({
    ...d,
    currentKeys: savedMap.get(d.id) ?? d.defaultKeys,
  }));
}

/** 修饰键规范顺序（用于规范化排序） */
const MODIFIER_ORDER = ["ctrl", "meta", "alt", "shift"];

/** 规范化组合键字符串（小写 + 修饰键固定顺序），用于比较；无主键时返回空串 */
export function normalizeKeys(keys: string): string {
  const parts = keys.split("+").map((k) => k.trim().toLowerCase());
  const mainKey = parts.find((k) => !MODIFIER_ORDER.includes(k));
  if (!mainKey) return "";
  const mods = parts
    .filter((k) => MODIFIER_ORDER.includes(k))
    .sort((a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b));
  return [...mods, mainKey].join("+");
}

/** 从键盘事件提取规范化的组合键字符串 */
export function keysFromEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.metaKey) parts.push("Meta");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  const modifierKeys = new Set(["Control", "Meta", "Alt", "Shift"]);
  if (e.key && !modifierKeys.has(e.key)) {
    parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
  }
  return normalizeKeys(parts.join("+"));
}

/**
 * 快捷键状态管理：
 * - 维护全局 UI 状态（设置弹窗 / 搜索弹窗可见性）
 * - 提供全局 keydown 分发（配置驱动）
 */
export const useShortcutStore = defineStore("shortcut", () => {
  const configStore = useConfigStore();

  /** 设置弹窗可见性（AppHeader 与快捷键共用） */
  const settingsVisible = ref(false);
  /** 全局搜索弹窗可见性 */
  const searchVisible = ref(false);

  /** 当前生效的快捷键（已保存配置合并默认值） */
  const effectiveShortcuts = computed<ShortcutItem[]>(() =>
    resolveShortcuts(configStore.config?.shortcuts),
  );

  /** 规范化组合键 -> 动作 映射 */
  const actionMap = computed(() => {
    const map = new Map<string, ShortcutActionId>();
    for (const item of effectiveShortcuts.value) {
      map.set(normalizeKeys(item.currentKeys), item.id);
    }
    return map;
  });

  function openSettings(): void {
    settingsVisible.value = true;
  }

  function closeSettings(): void {
    settingsVisible.value = false;
  }

  function toggleSettings(): void {
    settingsVisible.value = !settingsVisible.value;
  }

  function openSearch(): void {
    searchVisible.value = true;
  }

  function closeSearch(): void {
    searchVisible.value = false;
  }

  /** 全局 keydown 分发：命中已配置组合键时执行对应动作 */
  function handleKeydown(e: KeyboardEvent): void {
    const combo = keysFromEvent(e);
    if (!combo) return;
    const action = actionMap.value.get(combo);
    if (!action) return;
    e.preventDefault();
    e.stopPropagation();
    if (action === "settings") {
      openSettings();
    } else if (action === "search") {
      openSearch();
    }
  }

  /** 注册全局监听（App.vue onMounted 调用） */
  function init(): void {
    window.addEventListener("keydown", handleKeydown, true);
  }

  /** 移除全局监听（App.vue onUnmounted 调用） */
  function dispose(): void {
    window.removeEventListener("keydown", handleKeydown, true);
  }

  return {
    settingsVisible,
    searchVisible,
    effectiveShortcuts,
    openSettings,
    closeSettings,
    toggleSettings,
    openSearch,
    closeSearch,
    handleKeydown,
    init,
    dispose,
  };
});
