import { describe, it, expect } from "vitest";
import { parseReviewOutcome } from "@/main/core/services/review-outcome";

describe("parseReviewOutcome", () => {
  it("解析普通 JSON 输出", () => {
    const out = parseReviewOutcome(
      '{"decision":"approve","confidence":0.92,"issues":[]}',
    );
    expect(out.decision).toBe("approve");
    expect(out.confidence).toBe(0.92);
  });

  it("解析被 Markdown 代码块包裹的 JSON", () => {
    const out = parseReviewOutcome(
      '```json\n{"decision":"reject","confidence":0.4,"issues":["节奏拖沓"]}\n```',
    );
    expect(out.decision).toBe("reject");
    expect(out.issues).toEqual(["节奏拖沓"]);
  });

  it("无法解析时保守回退为 needs-user 且置信度 0", () => {
    const out = parseReviewOutcome("模型今天不想干活");
    expect(out.decision).toBe("needs-user");
    expect(out.confidence).toBe(0);
  });

  it("decision 非法值一律回退 needs-user", () => {
    expect(parseReviewOutcome('{"decision":"maybe"}').decision).toBe(
      "needs-user",
    );
  });

  it("置信度越界会被夹到 0..1", () => {
    expect(
      parseReviewOutcome('{"decision":"approve","confidence":3}').confidence,
    ).toBe(1);
    expect(
      parseReviewOutcome('{"decision":"approve","confidence":-1}').confidence,
    ).toBe(0);
  });

  it("issues 中的非字符串与空串被过滤", () => {
    const out = parseReviewOutcome(
      '{"decision":"reject","confidence":0.5,"issues":["有效", "", 42]}',
    );
    expect(out.issues).toEqual(["有效"]);
  });
});
