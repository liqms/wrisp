import { describe, it, expect, vi, beforeEach } from "vitest";

const { store } = vi.hoisted(() => ({
  store: { value: undefined as unknown },
}));

// 单测环境无 Electron 运行时
vi.mock("electron", () => ({
  app: {
    getAppPath: () => process.cwd(),
    getPath: () => process.cwd(),
  },
}));

vi.mock("@/main/core/services/config.service", () => ({
  configService: {
    getValue: (key: string) =>
      key === "writingPreference" ? store.value : undefined,
    setValue: (key: string, value: unknown) => {
      if (key === "writingPreference") store.value = value;
    },
  },
}));

import {
  mergePreferences,
  writingPreferenceService,
} from "@/main/core/services/writing-preference.service";

describe("mergePreferences", () => {
  it("标量字段被建议覆盖", () => {
    const merged = mergePreferences(
      { tone: "温和", reviewStrictness: "normal" },
      [{ field: "tone", value: "冷峻", reason: "太温和" }],
    );
    expect(merged.tone).toBe("冷峻");
  });

  it("数组成员已存在时不重复追加", () => {
    const merged = mergePreferences(
      { taboos: ["暴力"], reviewStrictness: "normal" },
      [{ field: "taboos", value: "暴力", reason: "x" }],
    );
    expect(merged.taboos).toEqual(["暴力"]);
  });

  it("数组成员为新值时追加", () => {
    const merged = mergePreferences(
      { taboos: ["暴力"], reviewStrictness: "normal" },
      [{ field: "taboos", value: "说教", reason: "x" }],
    );
    expect(merged.taboos).toEqual(["暴力", "说教"]);
  });

  it("reviewStrictness 不被反馈自动改写（审核宽严不该被单次反馈左右）", () => {
    const merged = mergePreferences(
      { reviewStrictness: "strict" },
      [{ field: "reviewStrictness", value: "lenient", reason: "x" }],
    );
    expect(merged.reviewStrictness).toBe("strict");
  });

  it("不修改传入对象（无副作用）", () => {
    const current = { tone: "温和", reviewStrictness: "normal" as const };
    const snapshot = JSON.stringify(current);
    mergePreferences(current, [{ field: "tone", value: "冷峻", reason: "x" }]);
    expect(JSON.stringify(current)).toBe(snapshot);
  });
});

describe("writingPreferenceService", () => {
  beforeEach(() => {
    store.value = undefined;
  });

  it("缺省时回退 normal 严格度与空数组", () => {
    const pref = writingPreferenceService.read();
    expect(pref.reviewStrictness).toBe("normal");
    expect(pref.taboos).toEqual([]);
    expect(pref.vocabulary).toEqual([]);
  });

  it("applySuggestions 落库后 read 能读回", () => {
    writingPreferenceService.applySuggestions([
      { field: "tone", value: "冷峻", reason: "太温和" },
    ]);
    expect(writingPreferenceService.read().tone).toBe("冷峻");
  });
});
