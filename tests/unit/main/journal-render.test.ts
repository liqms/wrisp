// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  renderJournalDay,
  parseJournalDayFile,
  inferEntryId,
  localTimeHeader,
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

  it("转义规则1：三种头形态按同一字符集逐字转义、解析逐字还原且不切分", () => {
    const md = renderJournalDay("2026-10-09", [
      e({ content: "计划表：\n**09:30**\n09:45\n[[10:15]]\n完毕" }),
    ]);
    // 粗体：每个 * 转义；裸：转义冒号；方括号：只转首个左括号
    expect(md).toContain("\\*\\*09:30\\*\\*");
    expect(md).toContain("09\\:45");
    expect(md).toContain("\\[[10:15]]");
    const parsed = parseJournalDayFile("2026-10-09", md);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].content).toBe("计划表：\n**09:30**\n09:45\n[[10:15]]\n完毕");
  });

  it("转义规则1：还原不吞掉用户自写的非目标反斜杠序列", () => {
    // 用户正文里的 \\ 与 \d 不在转义字符集内，还原时必须原样保留
    const tricky = "正则：\\d+\nWindows 路径 C:\\data";
    const parsed = parseJournalDayFile(
      "2026-10-09",
      renderJournalDay("2026-10-09", [e({ content: tricky })]),
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0].content).toBe(tricky);
  });

  it("转义规则2：整行 wrisp:entry 注释被 \\< 前缀保护（首个字符转义）", () => {
    const wholeLineComment = "前一行\n<!-- wrisp:entry {\"id\":\"x\"} -->\n后一行";
    const md = renderJournalDay("2026-10-09", [e({ content: wholeLineComment })]);
    expect(md).toContain("\\<!-- wrisp:entry {\"id\":\"x\"} -->");
    const parsed = parseJournalDayFile("2026-10-09", md);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].content).toBe(wholeLineComment);
  });

  it("转义规则2：行中包含但不整行匹配该注释时不转义（整行锚定，无歧义）", () => {
    const midLine = "注释样例 <!-- wrisp:entry {} --> 结束";
    const md = renderJournalDay("2026-10-09", [e({ content: midLine })]);
    expect(md).toContain(midLine); // 原样，未被加 \ 前缀
    expect(md).not.toContain("\\<!--");
    const parsed = parseJournalDayFile("2026-10-09", md);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].content).toBe(midLine);
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
    expect(again.map((p) => p.id)).toEqual(parsed.map((p) => p.id)); // sha256 派生的 UUID 形状确定性 id → 重复导入幂等
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

describe("Critical #1：围栏与权威条目边界（spec §5.2 规则 3 例外）", () => {
  it("(a) 未闭合围栏不再吞掉后续条目，两个 id 都被解析出来", () => {
    const entries = [
      e({ id: "e1", occurred_at: "2026-10-09T01:00:00.000Z", content: "看这个：\n```python\nprint(1)" }),
      e({ id: "e2", occurred_at: "2026-10-09T02:00:00.000Z", content: "正常正文" }),
    ];
    const md = renderJournalDay("2026-10-09", entries);
    const parsed = parseJournalDayFile("2026-10-09", md);
    expect(parsed.map((p) => p.id)).toEqual(["e1", "e2"]);
    expect(parsed[0].content).toBe("看这个：\n```python\nprint(1)");
    expect(parsed[1].content).toBe("正常正文");
  });

  it("(b) 嵌套围栏（``` 内套 ````markdown````）逐字节往返", () => {
    const body = [
      "外层说明",
      "```text",
      "内嵌 ````markdown 写法演示",
      "**09:30** 是被展示的样例头",
      "````",
      "```",
      "尾行",
    ].join("\n");
    const md = renderJournalDay("2026-10-09", [e({ content: body })]);
    const parsed = parseJournalDayFile("2026-10-09", md);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].content).toBe(body);
    // render → parse → render 字节稳定
    const second = renderJournalDay(
      "2026-10-09",
      parsed.map((p) => ({ ...p, updated_at: p.updated_at ?? p.occurred_at })),
    );
    expect(second).toBe(md);
  });

  it("(c) 平衡围栏内的裸时间戳头（非两行组合）仍不作为边界（规则 3 原有保护保留）", () => {
    const body = "笔记：\n```\n09:30\n这段仍在代码块里\n```\n结束";
    const md = renderJournalDay("2026-10-09", [e({ content: body })]);
    const parsed = parseJournalDayFile("2026-10-09", md);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].content).toBe(body);
  });
});

describe("Important #3：旧文件前言里的非日期标题不再丢失", () => {
  it("以手写标题起头的 legacy 文件，该标题保留进正文", () => {
    const legacy = "# 今日安排\n上午开会\n09:30\n晨会纪要\n";
    const parsed = parseJournalDayFile("2026-10-08", legacy);
    expect(parsed.length).toBeGreaterThanOrEqual(1);
    // 标题 + 散落正文归入首条（00:00:00），标题没被前言循环吞掉
    expect(parsed[0].occurred_at).toBe("2026-10-08T00:00:00");
    expect(parsed[0].content).toContain("# 今日安排");
    expect(parsed[0].content).toContain("上午开会");
  });

  it("渲染器自身的 # <date> 标题仍被前言跳过", () => {
    const md = renderJournalDay("2026-10-09", [e()]);
    const parsed = parseJournalDayFile("2026-10-09", md);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].content).toBe("今天研究了 LanceDB");
  });
});

describe("Minor：坏数据与稳定性", () => {
  it("#11 损坏的 wrisp:entry JSON 注释行被消费、不残留在正文", () => {
    const body = [
      "**09:30**",
      "<!-- wrisp:entry {这是坏 JSON} -->",
      "正文",
    ].join("\n");
    const parsed = parseJournalDayFile("2026-10-08", body);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].has_meta).toBe(false); // 无合法 id → 降级推断
    expect(parsed[0].content).toBe("正文"); // 坏注释行不进正文
    // 往返稳定：重渲染不含那条坏注释
    const md = renderJournalDay(
      "2026-10-08",
      parsed.map((p) => ({ ...p, updated_at: p.updated_at ?? p.occurred_at })),
    );
    expect(md).not.toContain("这是坏 JSON");
  });

  it("#12 不可解析的 occurred_at 抛错而非生成 NaN:NaN 坏头", () => {
    expect(() => localTimeHeader("not-a-date")).toThrow();
    expect(() => renderJournalDay("2026-10-09", [e({ occurred_at: "无效时间" })])).toThrow();
  });

  it("#5 排序按码点而非 locale：同 occurred_at 时 id 升序稳定", () => {
    const entries = [
      e({ id: "b", occurred_at: "2026-10-09T01:00:00.000Z" }),
      e({ id: "A", occurred_at: "2026-10-09T01:00:00.000Z" }),
      e({ id: "a", occurred_at: "2026-10-09T01:00:00.000Z" }),
    ];
    const parsed = parseJournalDayFile("2026-10-09", renderJournalDay("2026-10-09", entries));
    // 码点序：A(0x41) < a(0x61) < b(0x62)——localeCompare 可能给出 a,A,b 之类不同结果
    expect(parsed.map((p) => p.id)).toEqual(["A", "a", "b"]);
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
