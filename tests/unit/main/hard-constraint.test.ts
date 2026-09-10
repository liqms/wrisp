import { describe, it, expect } from "vitest";
import { detectHardConstraintHit } from "@/main/core/services/hard-constraint";

describe("detectHardConstraintHit", () => {
  it("命中禁忌词时返回命中项", () => {
    const hit = detectHardConstraintHit("他开始了暴力反击", {
      taboos: ["暴力"],
    });
    expect(hit?.constraint).toBe("暴力");
    expect(hit?.kind).toBe("taboo");
  });

  it("命中禁用词时归为 constraint", () => {
    const hit = detectHardConstraintHit("他掏出手机刷短视频", {
      forbiddenWords: ["手机", "短视频"],
    });
    expect(hit?.kind).toBe("constraint");
    expect(hit?.constraint).toBe("手机");
  });

  it("glossaryMustMatch 为真时出现专名即命中", () => {
    const hit = detectHardConstraintHit("他称其为「灰烬纪元」", {
      glossary: [{ term: "灰烬纪元", definition: "时代名" }],
      glossaryMustMatch: true,
    });
    expect(hit?.kind).toBe("glossary");
  });

  it("glossaryMustMatch 缺省时不因专名出现而命中", () => {
    const hit = detectHardConstraintHit("他称其为「灰烬纪元」", {
      glossary: [{ term: "灰烬纪元", definition: "时代名" }],
    });
    expect(hit).toBeNull();
  });

  it("无命中或空约束集时返回 null", () => {
    expect(detectHardConstraintHit("一切正常", { taboos: ["暴力"] })).toBeNull();
    expect(detectHardConstraintHit("任意文本", {})).toBeNull();
    expect(detectHardConstraintHit("", { taboos: ["暴力"] })).toBeNull();
  });
});
