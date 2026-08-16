import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import {
  useShortcutStore,
  resolveShortcuts,
  normalizeKeys,
  keysFromEvent,
} from "@/renderer/store/shortcut.store";

beforeEach(() => {
  setActivePinia(createPinia());
});

describe("resolveShortcuts", () => {
  it("saved 为空时回退到默认值", () => {
    const result = resolveShortcuts([]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("settings");
    expect(result[0].currentKeys).toBe("Ctrl+,");
    expect(result[1].id).toBe("search");
    expect(result[1].currentKeys).toBe("Ctrl+Shift+F");
  });

  it("按 id 用已保存值覆盖默认值，其余保留默认", () => {
    const result = resolveShortcuts([{ id: "settings", keys: "Alt+S" }]);
    expect(result.find((s) => s.id === "settings")?.currentKeys).toBe("Alt+S");
    expect(result.find((s) => s.id === "search")?.currentKeys).toBe(
      "Ctrl+Shift+F",
    );
  });

  it("saved 为 undefined 时也返回默认值", () => {
    expect(resolveShortcuts(undefined)).toHaveLength(2);
  });
});

describe("normalizeKeys", () => {
  it("忽略大小写并固定修饰键顺序", () => {
    expect(normalizeKeys("Ctrl+Shift+C")).toBe("ctrl+shift+c");
    expect(normalizeKeys("Shift+Ctrl+C")).toBe("ctrl+shift+c");
  });
});

describe("keysFromEvent", () => {
  it("提取 Ctrl+Shift+F", () => {
    const e = new KeyboardEvent("keydown", {
      key: "f",
      ctrlKey: true,
      shiftKey: true,
    });
    expect(keysFromEvent(e)).toBe("ctrl+shift+f");
  });

  it("纯修饰键不产生组合键", () => {
    const e = new KeyboardEvent("keydown", { key: "Control", ctrlKey: true });
    expect(keysFromEvent(e)).toBe("");
  });
});

describe("useShortcutStore", () => {
  it("命中默认 Ctrl+, 时打开设置弹窗", () => {
    const store = useShortcutStore();
    const e = new KeyboardEvent("keydown", { key: ",", ctrlKey: true });
    store.handleKeydown(e);
    expect(store.settingsVisible).toBe(true);
  });

  it("命中默认 Ctrl+Shift+F 时打开搜索弹窗", () => {
    const store = useShortcutStore();
    const e = new KeyboardEvent("keydown", {
      key: "f",
      ctrlKey: true,
      shiftKey: true,
    });
    store.handleKeydown(e);
    expect(store.searchVisible).toBe(true);
  });

  it("未配置的组合键不触发任何动作", () => {
    const store = useShortcutStore();
    const e = new KeyboardEvent("keydown", { key: "z", ctrlKey: true });
    store.handleKeydown(e);
    expect(store.settingsVisible).toBe(false);
    expect(store.searchVisible).toBe(false);
  });
});
