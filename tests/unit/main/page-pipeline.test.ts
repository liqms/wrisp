import { describe, it, expect } from "vitest";
import { resolvePagePipeline } from "@/main/core/skills/page-pipeline";

describe("resolvePagePipeline", () => {
  it("无声明时返回空流水线", () => {
    expect(resolvePagePipeline(undefined, {})).toEqual([]);
    expect(resolvePagePipeline([], {})).toEqual([]);
  });

  it("requiresConfirm 缺省视为 true（保守）", () => {
    const steps = resolvePagePipeline([{ id: "s1", skillId: "outline" }], {});
    expect(steps[0].requiresConfirm).toBe(true);
  });

  it("显式 false 时不再要求确认", () => {
    const steps = resolvePagePipeline(
      [{ id: "s1", skillId: "outline", requiresConfirm: false }],
      {},
    );
    expect(steps[0].requiresConfirm).toBe(false);
  });

  it("运行时上下文覆盖模板参数", () => {
    const steps = resolvePagePipeline(
      [
        {
          id: "s1",
          skillId: "outline",
          params: { text: "模板值", tone: "正式" },
        },
      ],
      { text: "运行时值" },
    );
    expect(steps[0].params).toEqual({ text: "运行时值", tone: "正式" });
  });

  it("保持声明顺序", () => {
    const steps = resolvePagePipeline(
      [
        { id: "a", skillId: "one" },
        { id: "b", skillId: "two" },
      ],
      {},
    );
    expect(steps.map((s) => s.stepId)).toEqual(["a", "b"]);
  });
});
