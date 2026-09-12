import { describe, it, expect } from "vitest";
import { decideGateOutcome } from "@/main/core/skills/gate-policy";

const base = {
  kind: "section" as const,
  delegated: true,
  reviewStrictness: "normal" as const,
  hitHardConstraint: false,
  confidence: 0.9,
  calibrated: true,
};

describe("decideGateOutcome", () => {
  it("未委托时交回人工", () => {
    expect(decideGateOutcome({ ...base, delegated: false })).toBe("needs-user");
  });

  it("命中硬约束时永不自动放行（即使 lenient 且高置信）", () => {
    expect(
      decideGateOutcome({
        ...base,
        hitHardConstraint: true,
        reviewStrictness: "lenient",
        confidence: 0.99,
      }),
    ).toBe("needs-user");
  });

  it("尚无历史校准时保守回退", () => {
    expect(decideGateOutcome({ ...base, calibrated: false })).toBe("needs-user");
  });

  it("normal 档：0.79 回退，0.8 放行", () => {
    expect(decideGateOutcome({ ...base, confidence: 0.79 })).toBe("needs-user");
    expect(decideGateOutcome({ ...base, confidence: 0.8 })).toBe("approve");
  });

  it("strict 档阈值更高（0.9 回退，0.95 放行）", () => {
    expect(
      decideGateOutcome({ ...base, reviewStrictness: "strict", confidence: 0.9 }),
    ).toBe("needs-user");
    expect(
      decideGateOutcome({
        ...base,
        reviewStrictness: "strict",
        confidence: 0.95,
      }),
    ).toBe("approve");
  });

  it("lenient 档阈值更低（0.6 放行）", () => {
    expect(
      decideGateOutcome({
        ...base,
        reviewStrictness: "lenient",
        confidence: 0.6,
      }),
    ).toBe("approve");
  });
});
