// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  renderJournalDay,
  parseJournalDayFile,
  inferEntryId,
} from "@/main/core/services/content/journal/journal-render";

const e = (over: Record<string, unknown> = {}) => ({
  id: "e1",
  occurred_at: "2026-10-09T01:32:00.000Z",
  source: "desktop",
  type: "text",
  content: "今天研究了 LanceDB",
  attachments: null,
  metadata: null,
  updated_at: "2026-10-09T01:32:00.000Z",
  ...over,
});

describe("renderJournalDay / parseJournalDayFile", () => {
  it("渲染包含文件标记、日期标题与条目头+注释元数据", () => {
    const md = renderJournalDay("2026-10-09", [e()]);
    expect(md).toContain(`<!-- wrisp:journal {"format":1,"date":"2026-10-09"} -->`);
    expect(md).toContain("<!-- wrisp:entry {");
    expect(md).toContain("\"id\":\"e1\"");
    expect(md).toMatch(/\*\*\d{2}:\d{2}\*\*/);
  });

  it("确定性：同输入两次渲染字节一致", () => {
    const a = renderJournalDay("2026-10-09", [e(), e({ id: "e2", occurred_at: "2026-10-09T02:00:00.000Z" })]);
    const b = renderJournalDay("2026-10-09", [e(), e({ id: "e2", occurred_at: "2026-10-09T02:00:00.000Z" })]);
    expect(a).toBe(b);
  });

  it("渲染→解析往返：条目集字段一致", () => {
    const entries = [e(), e({ id: "e2", content: "#标签 与 &[星际回声 计划]\n第二段落", source: "mobile", type: "voice" })];
    const md = renderJournalDay("2026-10-09", entries);
    const parsed = parseJournalDayFile("2026-10-09", md);
    expect(parsed.map((p) => p.id)).toEqual(["e1", "e2"]);
    expect(parsed[1].content).toBe(entries[1].content);
    expect(parsed[1].source).toBe("mobile");
    expect(parsed[1].updated_at).toBe(entries[1].updated_at);
  });

  it("转义规则1：正文中整行时间戳被 \\ 前缀保护，解析还原且不产生新条目", () => {
    const md = renderJournalDay("2026-10-09", [e({ content: "计划表：\n**09:30**\n09:45\n完毕" })]);
    expect(md).toContain("\\**09:30**");
    expect(md).toContain("\\09:45");
    const parsed = parseJournalDayFile("2026-10-09", md);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].content).toBe("计划表：\n**09:30**\n09:45\n完毕");
  });

  it("转义规则2：正文含 wrisp:entry 字面量被 \\ 前缀保护", () => {
    const tricky = "注释样例 <!-- wrisp:entry {} --> 结束";
    const parsed = parseJournalDayFile("2026-10-09", renderJournalDay("2026-10-09", [e({ content: tricky })]));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].content).toBe(tricky);
  });

  it("转义规则3：代码围栏内的时间戳行不转义、解析不切分", () => {
    const body = "示例：\n```text\n09:30 standup\n```\n结束";
    const md = renderJournalDay("2026-10-09", [e({ content: body })]);
    expect(md).toContain("09:30 standup"); // 围栏内不加 \
    const parsed = parseJournalDayFile("2026-10-09", md);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].content).toBe(body);
  });

  it("旧格式兼容：裸时间戳行、**09:30**、[[09:30]] 都成为推断条目（确定性 id 幂等）", () => {
    const legacy = "# 2026-10-08\n\n09:30\n晨会纪要\n\n**10:15**\n咖啡\n\n[[11:00]]\n读完一章\n";
    const parsed = parseJournalDayFile("2026-10-08", legacy);
    expect(parsed).toHaveLength(3);
    expect(parsed.map((p) => p.has_meta)).toEqual([false, false, false]);
    expect(parsed.map((p) => p.source)).toEqual(["import", "import", "import"]);
    expect(parsed[0].occurred_at).toBe("2026-10-08T09:30:00");
    const again = parseJournalDayFile("2026-10-08", legacy);
    expect(again.map((p) => p.id)).toEqual(parsed.map((p) => p.id)); // UUIDv5 风格确定性 id → 重复导入幂等
  });

  it("整篇无时间戳行 → 全文一条", () => {
    const parsed = parseJournalDayFile("2026-10-08", "今天随手记，没有任何时间戳。\n第二段。\n");
    expect(parsed).toHaveLength(1);
    expect(parsed[0].content).toBe("今天随手记，没有任何时间戳。\n第二段。");
    expect(parsed[0].occurred_at).toBe("2026-10-08T00:00:00");
  });

  it("inferEntryId 生成合法 8-4-4-4-12 且内容不同 id 不同", () => {
    const a = inferEntryId("2026-10-08", "2026-10-08T09:30:00", "x");
    const b = inferEntryId("2026-10-08", "2026-10-08T09:30:00", "y");
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});

/** 往返稳定性：渲染结果被解析回条目集后，再渲染必须逐字节相同（ensureDayFile 幂等的前提） */
describe("render → parse → render 稳定性", () => {
  const trickyContent = [
    "09:30 段落标题",
    "**10:00**",
    "[[11:00]]",
    "<!-- wrisp:entry {\"id\":\"fake\"} -->",
    "```text",
    "09:30 standup",
    "```",
    "尾行",
  ].join("\n");

  const dayEntries = () => [
    {
      id: "e1", occurred_at: "2026-10-09T01:32:00.000Z", source: "desktop", type: "text",
      content: trickyContent, attachments: null, metadata: null,
      updated_at: "2026-10-09T01:32:00.000Z",
    },
    {
      id: "e0", occurred_at: "2026-10-09T01:32:00.000Z", source: "mobile", type: "voice",
      content: "同一时间的第二条（按 id 稳定排序）",
      attachments: ["a.png"], metadata: { lang: "zh" },
      updated_at: "2026-10-09T02:00:00.000Z",
    },
  ];

  it("二次渲染与首次渲染字节一致", () => {
    const first = renderJournalDay("2026-10-09", dayEntries());
    const reparsed = parseJournalDayFile("2026-10-09", first);
    const second = renderJournalDay(
      "2026-10-09",
      reparsed.map((p) => ({ ...p, updated_at: p.updated_at ?? p.occurred_at })),
    );
    expect(second).toBe(first);
  });

  it("解析保留 meta 语义字段，且未因正文中的头形态多切条目", () => {
    const parsed = parseJournalDayFile("2026-10-09", renderJournalDay("2026-10-09", dayEntries()));
    expect(parsed.map((p) => p.id)).toEqual(["e0", "e1"]);
    expect(parsed.every((p) => p.has_meta)).toBe(true);
    expect(parsed[1].content).toBe(trickyContent);
    expect(parsed[0].attachments).toEqual(["a.png"]);
    expect(parsed[0].metadata).toEqual({ lang: "zh" });
  });
});
