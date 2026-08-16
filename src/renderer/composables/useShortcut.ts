import { useShortcutStore } from "@/renderer/store/shortcut.store";

/**
 * 快捷键相关组合函数（薄封装，与项目其他 composable 保持一致）
 */
export function useShortcut() {
  return useShortcutStore();
}

export type UseShortcutReturn = ReturnType<typeof useShortcut>;
