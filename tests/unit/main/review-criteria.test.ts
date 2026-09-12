import { describe, it, expect } from "vitest";
import { buildReviewCriteria } from "@/main/core/services/review-criteria";

describe("buildReviewCriteria", () => {
  it("把禁忌与作品约束列为硬性标准", () => {
    const criteria = buildReviewCriteria(
      { taboos: ["暴力"], reviewStrictness: "normal" },
      { tone: "冷峻", pov: "第一人称", constraints: ["不要出现现代词汇"] },
    );
    expect(criteria).toContain("暴力");
    expect(criteria).toContain("不要出现现代词汇");
    expect(criteria).toContain("硬性禁忌");
  });

  it("严格度映射为明确的判定要求", () => {
    expect(buildReviewCriteria({ reviewStrictness: "strict" })).toContain("偏严");
    expect(buildReviewCriteria({ reviewStrictness: "lenient" })).toContain("放宽");
    expect(buildReviewCriteria({ reviewStrictness: "normal" })).toContain("适中");
  });

  it("无禁忌无约束时也给出基调与视角要求", () => {
    const criteria = buildReviewCriteria(
      { reviewStrictness: "normal" },
      { tone: "冷峻", pov: "第一人称" },
    );
    expect(criteria).toContain("冷峻");
    expect(criteria).toContain("第一人称");
  });
});
