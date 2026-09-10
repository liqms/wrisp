import { describe, it, expect } from "vitest";
import { buildRevisionInstruction } from "@/main/core/services/revision-instruction";

describe("buildRevisionInstruction", () => {
  it("把问题清单组织为局部修正指令，并限定只改被点名处", () => {
    const instruction = buildRevisionInstruction(["节奏拖沓", "对话生硬"]);
    expect(instruction).toContain("节奏拖沓");
    expect(instruction).toContain("对话生硬");
    expect(instruction).toContain("仅修改");
    expect(instruction).toContain("不要重写未被提到的部分");
  });

  it("无有效问题时返回空串（不做无意义重写）", () => {
    expect(buildRevisionInstruction([])).toBe("");
    expect(buildRevisionInstruction(["  "])).toBe("");
  });

  it("去重相同问题", () => {
    const instruction = buildRevisionInstruction(["太啰嗦", "太啰嗦"]);
    expect(instruction.match(/太啰嗦/g)).toHaveLength(1);
  });

  it("去除每条问题的首尾空白", () => {
    const instruction = buildRevisionInstruction(["  节奏慢  "]);
    expect(instruction).toContain("- 节奏慢");
  });
});
