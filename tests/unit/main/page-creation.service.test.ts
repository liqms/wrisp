import { describe, it, expect } from "vitest";
import { pageCreationService } from "@/main/core/services/page-creation.service";

describe("pageCreationService", () => {
  it("用户选择不生成大纲时跳过大纲阶段", () => {
    expect(pageCreationService.shouldGenerateOutline(false)).toBe(false);
    expect(pageCreationService.shouldGenerateOutline(true)).toBe(true);
  });

  it("构造确认门上下文：逐项委托 + 严格度 + Reviewer 判定", () => {
    const ctx = pageCreationService.buildGateContext(
      { delegation: { section: true } },
      "section",
      { confidence: 0.9, hitHardConstraint: false, calibrated: true },
      "normal",
    );

    expect(ctx.delegated).toBe(true);
    expect(ctx.kind).toBe("section");
    expect(ctx.confidence).toBe(0.9);
    expect(ctx.reviewStrictness).toBe("normal");
  });

  it("未开启该步骤委托时 delegated 为 false（保守，交回人工）", () => {
    const ctx = pageCreationService.buildGateContext(
      { delegation: {} },
      "outline",
      { confidence: 0.99, hitHardConstraint: false, calibrated: true },
      "lenient",
    );

    expect(ctx.delegated).toBe(false);
  });

  it("把 Reviewer 的硬约束命中如实透传（不在此处放行）", () => {
    const ctx = pageCreationService.buildGateContext(
      { delegation: { section: true } },
      "section",
      { confidence: 0.99, hitHardConstraint: true, calibrated: true },
      "lenient",
    );

    expect(ctx.hitHardConstraint).toBe(true);
  });
});
