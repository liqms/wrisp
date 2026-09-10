import { describe, it, expect } from "vitest";
import { extractPreferenceSignals } from "@/main/core/services/preference-signals";

describe("extractPreferenceSignals", () => {
  it("确认不产生任何建议（无信号）", () => {
    expect(extractPreferenceSignals("confirm", "写得不错")).toEqual([]);
  });

  it("打回且提及句式时产出对应字段建议，并带上原文作为理由", () => {
    const suggestions = extractPreferenceSignals(
      "reject",
      "整体太啰嗦了，句式再简短一些",
    );
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].field).toBe("sentenceStyle");
    expect(suggestions[0].reason).toContain("太啰嗦");
  });

  it("提及禁忌时归到 taboos，并剥离前缀词", () => {
    const suggestions = extractPreferenceSignals("edit", "不要出现暴力描写");
    const taboo = suggestions.find((s) => s.field === "taboos");
    expect(taboo?.value).toContain("暴力");
  });

  it("空反馈不产生建议", () => {
    expect(extractPreferenceSignals("reject", "")).toEqual([]);
    expect(extractPreferenceSignals("edit", "   ")).toEqual([]);
  });
});
