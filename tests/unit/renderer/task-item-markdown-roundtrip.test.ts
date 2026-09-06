import { describe, it, expect } from "vitest";
import { marked } from "marked";
import { registerTaskItemBridge } from "@/renderer/components/editor/features/task-item/task-item-extension";

// 模拟应用启动时的桥接注册（幂等）
registerTaskItemBridge();

describe("任务列表 marked 桥接（读链路：- [ ]/- [x] → 桥接 HTML）", () => {
  it("- [ ] 输出 taskList 桥接 HTML，data-checked=false", () => {
    const html = marked.parse("- [ ] 未完成任务") as string;
    expect(html).toContain('<ul data-type="taskList">');
    expect(html).toContain('data-type="taskItem"');
    expect(html).toContain('data-checked="false"');
    expect(html).toContain("未完成任务");
  });

  it("- [x] 输出 data-checked=true 且 checkbox 带选中态（阅读态显示）", () => {
    const html = marked.parse("- [x] 已完成任务") as string;
    expect(html).toContain('data-checked="true"');
    expect(html).toContain('checked="checked"');
  });

  it("行尾 [[YYYY-MM-DD]] 提升为 data-date 属性并从文本剥离", () => {
    const html = marked.parse("- [x] 完成报告 [[2026-09-06]]") as string;
    expect(html).toContain('data-date="2026-09-06"');
    expect(html).toContain("完成报告");
    expect(html).not.toContain("[[2026-09-06]]");
  });

  it("非日期格式的 [[wiki 链接]] 保留在文本中（不误剥离）", () => {
    const html = marked.parse("- [ ] 阅读 [[项目笔记]]") as string;
    expect(html).not.toContain("data-date");
    expect(html).toContain("[[项目笔记]]");
  });

  it("多项任务逐项输出 li", () => {
    const html = marked.parse("- [ ] A\n- [x] B") as string;
    expect(html).toContain('data-checked="false"');
    expect(html).toContain('data-checked="true"');
    expect((html.match(/<li /g) ?? []).length).toBe(2);
  });

  it("嵌套任务保留层级（嵌套 taskList）", () => {
    const html = marked.parse("- [ ] 父任务\n  - [x] 子任务") as string;
    expect(html).toContain("父任务");
    expect(html).toContain("子任务");
    expect((html.match(/<ul data-type="taskList">/g) ?? []).length).toBe(2);
  });

  it("普通无序列表不受桥接影响", () => {
    const html = marked.parse("- 普通项") as string;
    expect(html).not.toContain('data-type="taskList"');
    expect(html).not.toContain('data-type="taskItem"');
    expect(html).toContain("普通项");
  });

  it("段落后的任务行正确断段（start 钩子）", () => {
    const html = marked.parse("前置段落。\n- [ ] 任务") as string;
    expect(html).toContain("<p>前置段落。</p>");
    expect(html).toContain('data-type="taskItem"');
  });
});
