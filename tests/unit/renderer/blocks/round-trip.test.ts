import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { marked } from "marked";
import { defineComponent, h } from "vue";
import type { Node as PMNode } from "@tiptap/pm/model";
import { metricCardBlock } from "@/renderer/components/editor/blocks/definitions/metric";
import { createBlockNodes } from "@/renderer/components/editor/blocks/engine/node-factory";
import { registerWrispBlockBridge } from "@/renderer/components/editor/blocks/engine/marked-bridge";
import { getBlocks } from "@/renderer/components/editor/blocks/registry";
import {
  closeBlockEditor,
  blockEditState,
} from "@/renderer/components/editor/blocks/components/bus";
import { insertBlock } from "@/renderer/components/editor/slash/commands/blocks.commands";

// 模拟应用启动时的桥接注册（幂等）
registerWrispBlockBridge(getBlocks());

// NodeView 打桩：避免测试环境挂载真实 Vue 组件（i18n / naive-ui 依赖）
const CardStub = defineComponent({ name: "CardStub", render: () => h("div") });
const GroupStub = defineComponent({ name: "GroupStub", render: () => h("div") });

const editors: Editor[] = [];

function createEditor(): Editor {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const editor = new Editor({
    element: el,
    extensions: [
      StarterKit,
      Markdown,
      ...createBlockNodes({
        ...metricCardBlock,
        cardView: CardStub,
        groupView: GroupStub,
      }),
    ],
  });
  editors.push(editor);
  return editor;
}

/** 复现应用读取链路：md →（marked 桥接）→ HTML → setContent */
function loadMarkdown(editor: Editor, md: string): void {
  const html = marked.parse(md) as string;
  editor.commands.setContent(html);
}

/** 统计文档中指定类型节点 */
function countNodes(editor: Editor, type: string): number {
  let count = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === type) count += 1;
    return true;
  });
  return count;
}

/** 找到第一个指定类型节点 */
function findNode(editor: Editor, type: string): PMNode | null {
  let found: PMNode | null = null;
  editor.state.doc.descendants((node) => {
    if (!found && node.type.name === type) {
      found = node;
      return false;
    }
    return true;
  });
  return found;
}

/** 在文档中定位第一个匹配字符的绝对位置 */
function findPos(editor: Editor, needle: string): number {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.isText && node.text) {
      const idx = node.text.indexOf(needle);
      if (idx >= 0) {
        found = pos + idx;
        return false;
      }
    }
    return true;
  });
  return found;
}

/** 收集文档中指定类型的所有节点 */
function collectNodes(editor: Editor, type: string): PMNode[] {
  const nodes: PMNode[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === type) nodes.push(node);
    return true;
  });
  return nodes;
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy();
});

describe("自定义块 markdown round-trip", () => {
  it(":::metric 围栏 → 桥接 HTML → metricGroup + metric 节点", () => {
    const editor = createEditor();
    const md = ":::metric\nlabel: 日活跃用户\nvalue: 1.2万\ntrend: +8%\n:::";
    const html = marked.parse(md) as string;

    expect(html).toContain('data-wrisp-block-group="metric"');
    expect(html).toContain('data-wrisp-block="metric"');
    expect(html).toContain('data-f-label="日活跃用户"');

    editor.commands.setContent(html);
    expect(countNodes(editor, "metricGroup")).toBe(1);
    expect(countNodes(editor, "metric")).toBe(1);

    const metric = findNode(editor, "metric");
    expect(metric?.attrs).toMatchObject({
      label: "日活跃用户",
      value: "1.2万",
      trend: "+8%",
      trendDir: "up",
    });
  });

  it("解析时清洗：非法枚举回退默认值、未知字段丢弃", () => {
    const editor = createEditor();
    loadMarkdown(
      editor,
      ":::metric\nlabel: DAU\ntrendDir: sideways\nfoo: bar\n:::",
    );
    const metric = findNode(editor, "metric");
    expect(metric?.attrs).toMatchObject({ label: "DAU", trendDir: "up" });
    expect(Object.keys(metric?.attrs ?? {})).not.toContain("foo");
  });

  it("getMarkdown 输出确定性格式：默认值字段省略", () => {
    const editor = createEditor();
    loadMarkdown(
      editor,
      ":::metric\nlabel: DAU\nvalue: 123\nunit: 万\n:::",
    );
    const out = editor.getMarkdown();
    expect(out).toContain(":::metric");
    expect(out).toContain("label: DAU");
    expect(out).toContain("value: 123");
    expect(out).toContain("unit: 万");
    // trendDir 为默认值 up，不落盘
    expect(out).not.toContain("trendDir");
    expect(out.trimEnd().endsWith(":::")).toBe(true);
  });

  it("round-trip 幂等：加载 → 序列化 → 再加载 → 再序列化结果一致", () => {
    const editor = createEditor();
    const md = ":::metric\nlabel: DAU\nvalue: 123\ntrend: -3%\ntrendDir: down\n:::";
    loadMarkdown(editor, md);
    const once = editor.getMarkdown();

    loadMarkdown(editor, once);
    const twice = editor.getMarkdown();
    expect(twice).toBe(once);
  });

  it("混合文档 round-trip：标题 + 卡片 + 段落不丢失", () => {
    const editor = createEditor();
    const md = [
      "# 周报",
      "",
      ":::metric",
      "label: DAU",
      "value: 123",
      ":::",
      "",
      "结论文字。",
    ].join("\n");

    loadMarkdown(editor, md);
    const out = editor.getMarkdown();

    expect(out).toContain("# 周报");
    expect(out).toContain("label: DAU");
    expect(out).toContain("结论文字。");

    // 二次 round-trip 稳定
    loadMarkdown(editor, out);
    expect(editor.getMarkdown()).toBe(out);
  });

  it("连续围栏（无空行）归组为单个容器", () => {
    const editor = createEditor();
    loadMarkdown(
      editor,
      ":::metric\nlabel: A\n:::\n:::metric\nlabel: B\n:::\n:::metric\nlabel: C\n:::",
    );
    expect(countNodes(editor, "metricGroup")).toBe(1);
    expect(countNodes(editor, "metric")).toBe(3);
  });

  it("空行分隔的同类围栏仍归为一组（空行不作为组边界）", () => {
    const editor = createEditor();
    loadMarkdown(
      editor,
      ":::metric\nlabel: A\n:::\n\n:::metric\nlabel: B\n:::",
    );
    // 空行后的同类围栏仍排入同一 flex 容器，分行由布局自动完成
    expect(countNodes(editor, "metricGroup")).toBe(1);
    expect(countNodes(editor, "metric")).toBe(2);

    // 保存重载后结构稳定（序列化输出为连续围栏）
    const out = editor.getMarkdown();
    loadMarkdown(editor, out);
    expect(countNodes(editor, "metricGroup")).toBe(1);
    expect(countNodes(editor, "metric")).toBe(2);
  });

  it("卡片围栏与普通段落之间的空行正常分隔（不吞内容）", () => {
    const editor = createEditor();
    loadMarkdown(
      editor,
      ":::metric\nlabel: A\n:::\n\n结论文字。",
    );
    expect(countNodes(editor, "metricGroup")).toBe(1);
    expect(editor.state.doc.textContent).toContain("结论文字。");
  });

  it("段落内出现围栏开启行时提前断段（不吞内容）", () => {
    const editor = createEditor();
    loadMarkdown(
      editor,
      "开头文字\n:::metric\nlabel: A\n:::",
    );
    expect(countNodes(editor, "metricGroup")).toBe(1);
    // 段落文字保留，卡片字段进入 attrs（atom 节点不出现在 doc 文本中）
    expect(editor.state.doc.textContent).toContain("开头文字");
    const metric = findNode(editor, "metric");
    expect(metric?.attrs.label).toBe("A");
  });

  it("未闭合围栏降级为普通文本（不丢失）", () => {
    const editor = createEditor();
    loadMarkdown(editor, ":::metric\nlabel: 只有内容没有闭合");
    expect(countNodes(editor, "metric")).toBe(0);
    const text = editor.state.doc.textContent;
    expect(text).toContain(":::metric");
    expect(text).toContain("label: 只有内容没有闭合");
  });

  it("slash 插入形态（group 包裹卡片）round-trip 结构稳定", () => {
    const editor = createEditor();
    // 复现 insertBlock：插入 metricGroup(metric) 结构
    editor.commands.insertContent({
      type: "metricGroup",
      content: [{ type: "metric", attrs: { label: "DAU", value: "123" } }],
    });
    expect(countNodes(editor, "metricGroup")).toBe(1);
    expect(countNodes(editor, "metric")).toBe(1);

    const once = editor.getMarkdown();
    // 保存重载后仍是 1 组 1 卡（结构从首次往返即稳定）
    loadMarkdown(editor, once);
    expect(countNodes(editor, "metricGroup")).toBe(1);
    expect(countNodes(editor, "metric")).toBe(1);
    expect(editor.getMarkdown()).toBe(once);
  });

  it("分组末尾追加卡片：默认 attrs 来自节点 schema，序列化后结构保持", () => {
    const editor = createEditor();
    loadMarkdown(editor, ":::metric\nlabel: A\n:::");

    // 复现 GroupView.addCard：按分组内容规则推导卡片类型并插入末尾
    let pos = -1;
    editor.state.doc.descendants((node, p) => {
      if (node.type.name === "metricGroup" && pos < 0) {
        pos = p;
        return false;
      }
      return true;
    });
    const groupNode = editor.state.doc.nodeAt(pos)!;
    const cardType = groupNode.type.contentMatch.defaultType!;
    const end = pos + 1 + groupNode.content.size;
    editor
      .chain()
      .command(({ tr }) => {
        tr.insert(end, cardType.create({}));
        return true;
      })
      .run();

    expect(countNodes(editor, "metric")).toBe(2);
    const cards = collectNodes(editor, "metric");
    expect(cards[1].attrs).toMatchObject({
      label: "",
      value: "",
      trendDir: "up",
    });

    // 序列化 → 重载 → 仍是一组两卡
    const out = editor.getMarkdown();
    loadMarkdown(editor, out);
    expect(countNodes(editor, "metricGroup")).toBe(1);
    expect(countNodes(editor, "metric")).toBe(2);
    expect(editor.getMarkdown()).toBe(out);
  });

  it("slash 插入：定位到新卡片并自动打开编辑弹窗", () => {
    const editor = createEditor();
    // 构造真实 slash 场景：段落内 "/指标"（startPos = 斜杠后一位，与 SlashMenu 传参一致）
    editor.commands.setContent("<p>/指标</p>");
    const slashPos = findPos(editor, "/") + 1;

    insertBlock(editor, slashPos, metricCardBlock);

    // 弹窗请求已自动打开
    const request = blockEditState.value;
    expect(request).not.toBeNull();
    expect(request?.nodeType).toBe("metric");
    expect(request?.editor).toBe(editor);

    // 请求携带的 pos 精确指向卡片（保存时 setNodeMarkup 不错位）
    const pos = request?.pos ?? -1;
    expect(pos).toBeGreaterThanOrEqual(0);
    expect(editor.state.doc.nodeAt(pos)?.type.name).toBe("metric");
    expect(editor.state.doc.nodeAt(pos)?.attrs.trendDir).toBe("up");

    // 斜杠与查询词已删除
    expect(editor.state.doc.textContent).not.toContain("/");

    closeBlockEditor();
    expect(blockEditState.value).toBeNull();
  });

  it("连续 slash 插入：前邻是同类分组时并入，不产生多个单卡分组", () => {
    const editor = createEditor();
    // 第一张卡：空文档中 "/指标"（插入后 PM 保留尾部空段落，光标自然停留其中）
    editor.commands.setContent("<p>/指标</p>");
    insertBlock(editor, findPos(editor, "/") + 1, metricCardBlock);
    closeBlockEditor();
    expect(countNodes(editor, "metricGroup")).toBe(1);
    expect(countNodes(editor, "metric")).toBe(1);

    // 第二张卡：用户在分组后的空段落中继续输入 "/指标"（真实光标流）
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertContent("/指标");
    insertBlock(editor, findPos(editor, "/") + 1, metricCardBlock);

    // 只有一个分组，两张卡（卡片在同一个 flex 容器内排版）
    expect(countNodes(editor, "metricGroup")).toBe(1);
    expect(countNodes(editor, "metric")).toBe(2);
    // 结构断言：卡片必须插入分组内部（不能是 doc 层的裸卡片）
    expect(findNode(editor, "metricGroup")?.childCount).toBe(2);

    // 弹窗定位到新追加的卡片
    const pos = blockEditState.value?.pos ?? -1;
    expect(editor.state.doc.nodeAt(pos)?.type.name).toBe("metric");
    closeBlockEditor();

    // 第三张卡继续在同一空段落输入 → 继续并入
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertContent("/指标");
    insertBlock(editor, findPos(editor, "/") + 1, metricCardBlock);
    closeBlockEditor();
    expect(countNodes(editor, "metricGroup")).toBe(1);
    expect(countNodes(editor, "metric")).toBe(3);

    // 保存重载后结构一致（一组三卡）
    const out = editor.getMarkdown();
    loadMarkdown(editor, out);
    expect(countNodes(editor, "metricGroup")).toBe(1);
    expect(countNodes(editor, "metric")).toBe(3);
  });

  it("段落含其他文本时不并入，插入独立分组", () => {
    const editor = createEditor();
    loadMarkdown(editor, ":::metric\nlabel: A\n:::\n\n备注/指标");
    insertBlock(editor, findPos(editor, "/") + 1, metricCardBlock);

    // 段落非空 → 不并入，形成第二个分组
    expect(countNodes(editor, "metricGroup")).toBe(2);
    expect(countNodes(editor, "metric")).toBe(2);

    // 弹窗定位仍指向新卡片
    const pos = blockEditState.value?.pos ?? -1;
    expect(editor.state.doc.nodeAt(pos)?.type.name).toBe("metric");
    closeBlockEditor();
  });
});
