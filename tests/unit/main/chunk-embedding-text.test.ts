// @vitest-environment node
import { describe, it, expect } from "vitest";

import { buildEmbeddingText } from "@/main/core/services/content/splitting/embedding-text";

describe("语义块向量化文本", () => {
  it("::: 自定义块走字段拼装，指标名与数值进入同一条向量", () => {
    const text = buildEmbeddingText({
      content: ":::metric\nlabel: DAU\nvalue: 12k\ntrend: up\n:::",
      ai_summary: "这段内容描述了日活跃用户的变化情况。",
    });

    expect(text).toBe("metric: label DAU, value 12k, trend up");
    // 卡片正文本身就是结构化字段，模型摘要只会稀释字段权重
    expect(text).not.toContain("这段内容");
  });

  it("块类型无关：新块类型无需改这里", () => {
    const text = buildEmbeddingText({
      content: ":::todo\nitem: 补写周报\ndue: 周五\n:::",
      ai_summary: null,
    });

    expect(text).toContain("todo");
    expect(text).toContain("item 补写周报");
    expect(text).toContain("due 周五");
  });

  it("省略空值字段", () => {
    const text = buildEmbeddingText({
      content: ":::metric\nlabel: DAU\nvalue:\n:::",
      ai_summary: null,
    });

    expect(text).toBe("metric: label DAU");
  });

  it("普通文本块仍是摘要优先，无摘要时用正文", () => {
    expect(
      buildEmbeddingText({ content: "正文内容。", ai_summary: "摘要内容。" }),
    ).toBe("摘要内容。");
    expect(
      buildEmbeddingText({ content: "正文内容。", ai_summary: null }),
    ).toBe("正文内容。");
  });
});
