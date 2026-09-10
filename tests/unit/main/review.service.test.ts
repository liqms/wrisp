import { describe, it, expect } from "vitest";
import { reviewService } from "@/main/core/services/review.service";

const base = {
  rawReview: '{"decision":"approve","confidence":0.95,"issues":[]}',
  text: "一段正常产出",
  constraints: { taboos: ["暴力"] },
  session: { delegation: { section: true } },
  kind: "section" as const,
  reviewStrictness: "normal" as const,
  calibrated: true,
};

describe("reviewService.evaluateAndDecide", () => {
  it("高置信且无硬约束命中时放行", () => {
    expect(reviewService.evaluateAndDecide(base).outcome).toBe("approve");
  });

  it("命中硬约束时回退人工（即使 Reviewer 说 approve）", () => {
    const result = reviewService.evaluateAndDecide({
      ...base,
      text: "他开始了暴力反击",
    });
    expect(result.outcome).toBe("needs-user");
    expect(result.hit?.constraint).toBe("暴力");
  });

  it("未委托该步骤时回退人工", () => {
    const result = reviewService.evaluateAndDecide({
      ...base,
      session: { delegation: {} },
    });
    expect(result.outcome).toBe("needs-user");
  });

  it("Reviewer 判 reject 时透传问题清单并给出修正指令", () => {
    const result = reviewService.evaluateAndDecide({
      ...base,
      rawReview: '{"decision":"reject","confidence":0.5,"issues":["节奏拖沓"]}',
    });
    expect(result.outcome).toBe("needs-user");
    expect(result.reviewerDecision).toBe("reject");
    expect(result.revisionInstruction).toContain("节奏拖沓");
  });

  it("原始输出不可识别时回退人工", () => {
    const result = reviewService.evaluateAndDecide({
      ...base,
      rawReview: "跑飞了",
    });
    expect(result.outcome).toBe("needs-user");
  });

  it("置信度不足时回退人工（交给确认门策略判定）", () => {
    const result = reviewService.evaluateAndDecide({
      ...base,
      rawReview: '{"decision":"approve","confidence":0.5,"issues":[]}',
    });
    expect(result.outcome).toBe("needs-user");
  });
});
