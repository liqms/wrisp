// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  countProseWords,
  countWords,
} from "@/main/core/services/content/splitting/text";

describe("countProseWords 剥 Markdown 后的正文字数", () => {
  it("代码围栏整块不算正文", () => {
    expect(
      countProseWords("```ts\nconst a = 1;\nconsole.log(a);\nfor (let i = 0; i < 10; i++) {}\n```"),
    ).toBe(0);
  });

  it("未闭合的代码围栏吃掉剩余行（与 L1 粗块的围栏态一致）", () => {
    expect(countProseWords("```python\nprint('hello world')")).toBe(0);
  });

  it("::: 围栏（mermaid / 提示块等）整块不算正文", () => {
    expect(countProseWords(":::mermaid\ngraph TD;\nA-->B;\nB-->C;\n:::")).toBe(0);
    expect(countProseWords(":::note\n这是一段提示内容，写了很长的中文句子用来凑字数\n:::")).toBe(0);
  });

  it("未闭合的 ::: 围栏按普通正文处理（与渲染层降级一致）", () => {
    const text = ":::note\n这段文字没有闭合围栏，应当按正文计算字数";
    expect(countProseWords(text)).toBeGreaterThan(0);
  });

  it("纯图片块不算正文", () => {
    expect(countProseWords("![架构图示说明](./assets/architecture.png)")).toBe(0);
  });

  it("链接只保留锚点文字，URL 不计入字数", () => {
    expect(countProseWords("参见 [官方文档](https://example.com/a/b/c?x=1&y=2)")).toBe(6);
  });

  it("行内代码不算正文", () => {
    expect(countProseWords("`npm install -g pnpm@8` `pnpm dev` `pnpm build`")).toBe(0);
  });

  it("标题 / 列表 / 引用只剥标记，文字仍计入", () => {
    expect(countProseWords("## 本周结论\n- 完成迁移\n> 待观察")).toBe(11);
  });

  it("分隔线与表格分隔行不算正文", () => {
    expect(countProseWords("---\n***\n\n   \n")).toBe(0);
  });

  it("表格单元格文字仍算正文（表格属于可摘要内容）", () => {
    const table = "| 指标 | 数值 |\n| --- | --- |\n| 日活 | 12000 |\n| 留存率 | 45% |";
    expect(countProseWords(table)).toBeGreaterThan(0);
  });

  it("HTML 标签剥离后按文字计数", () => {
    expect(countProseWords("<div>这是一段中文</div>")).toBe(6);
  });

  it("纯正文与 countWords 口径一致", () => {
    const text = "本周完成了向量检索链路的改造，召回质量有明显提升。";
    expect(countProseWords(text)).toBe(countWords(text));
  });

  it("代码块与正文混排时只统计正文部分", () => {
    const mixed = [
      "这段说明介绍了启动方式的差异，需要读者留意端口占用的问题。",
      "",
      "```bash",
      "pnpm dev",
      "```",
    ].join("\n");
    expect(countProseWords(mixed)).toBe(countWords("这段说明介绍了启动方式的差异，需要读者留意端口占用的问题。"));
  });
});
