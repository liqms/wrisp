import { describe, it, expect } from "vitest";
import { parseOutline } from "@/main/core/services/outline.parser";

describe("parseOutline", () => {
  it("按 Markdown 列表解析为节点，状态初始为 pending", () => {
    const nodes = parseOutline("- 初到边城\n- 遇见旧友\n- 夜谈");
    expect(nodes.map((n) => n.title)).toEqual(["初到边城", "遇见旧友", "夜谈"]);
    expect(nodes.every((n) => n.status === "pending")).toBe(true);
  });

  it("支持 '标题：摘要' 形式，摘要单独取出", () => {
    const nodes = parseOutline("- 初到边城：主角抵达边城，见到旧识");
    expect(nodes[0].title).toBe("初到边城");
    expect(nodes[0].summary).toBe("主角抵达边城，见到旧识");
  });

  it("支持有序列表", () => {
    const nodes = parseOutline("1. 甲\n2. 乙");
    expect(nodes.map((n) => n.title)).toEqual(["甲", "乙"]);
  });

  it("摘要缺省为空串，且忽略空行与非列表行", () => {
    const nodes = parseOutline("以下是提纲：\n\n- 只有标题\n\n");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].summary).toBe("");
  });

  it("为每个节点生成唯一 id", () => {
    const nodes = parseOutline("- 甲\n- 乙");
    expect(nodes[0].id).not.toBe(nodes[1].id);
  });
});
