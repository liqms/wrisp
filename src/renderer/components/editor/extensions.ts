import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import Placeholder from "@tiptap/extension-placeholder";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { Markdown } from "@tiptap/markdown";
import type { Extensions } from "@tiptap/core";
import { getBlocks } from "./blocks/registry";
import { registerWrispBlockBridge } from "./blocks/engine/marked-bridge";
import { createBlockNodes } from "./blocks/engine/node-factory";
import DragHandle from "@tiptap/extension-drag-handle";
import { DropLine, handleNodeChange, renderDragHandle } from "./features/drag-reorder/drag-reorder";
import { Admonition, registerAdmonitionBridge } from "./features/admonition/admonition-extension";
import { WrispTaskItem, registerTaskItemBridge } from "./features/task-item/task-item-extension";
import { Ruby } from "./features/ruby/ruby-extension";
import { createLegacyMentionExtension } from "./features/mention/mention-extension";
import { createInlineSemanticSuggestExtension } from "./features/inline-semantic/inline-semantic-suggest";
import { createInlineSemanticDecoration } from "./features/inline-semantic/inline-semantic-decoration";
import { createMathematicsExtension } from "./features/math/mathematics-extension";
import { createCodeBlockLowlight } from "./features/code-block/code-block-extension";
import { createImageExtension } from "./features/image/image-extension";

// 在全局 marked 单例上注册 `:::name` 围栏的解析桥接（幂等）。
// 读取链路（mdToHtml）与插入链路（insertMarkdownTemplate）均经该单例解析。
registerWrispBlockBridge(getBlocks());
// 在全局 marked 单例上注册 `:::type` 提示块围栏的解析桥接（幂等）
registerAdmonitionBridge();
// 在全局 marked 单例上注册 `- [ ]/- [x]` 任务行桥接（幂等）
registerTaskItemBridge();

export function getExtensions(placeholder?: string): Extensions {
  const exts: Extensions = [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
      // tiptap v3 StarterKit 已内置 link 和 underline，此处关闭以去重
      link: false,
      underline: false,
      // codeBlock 由 CodeBlockLowlight 替代（语法高亮 + 悬浮工具栏）
      codeBlock: false,
      // 块拖拽的落点指示由 DropLine 插入线替代，关闭原生竖线光标避免双重指示
      dropcursor: false,
    }),
    // 块拖拽排序：左侧拖拽手柄（官方扩展负责手柄定位/dragstart/拖拽预览）
    // 手柄含"＋"添加块按钮：onNodeChange 记录当前悬停块供按钮定位插入点。
    // 官方 computePosition 用 absolute 策略，在 Naive UI 滚动布局下 offsetParent
    // 参照链错乱导致手柄偏移——由 drag-reorder 内的接管逻辑改为 fixed 视口定位。
    DragHandle.configure({
      render: renderDragHandle,
      onNodeChange: handleNodeChange,
    }),
    // 代码块：lowlight 语法高亮 + 语言选择/复制工具栏
    createCodeBlockLowlight(),
    Link.configure({
      openOnClick: true,
      HTMLAttributes: {
        target: "_blank",
        rel: "noopener noreferrer",
      },
    }),
    Underline,
    // 图片扩展（支持宽度/对齐属性 + 拖拽缩放手柄）
    createImageExtension(),
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
    Highlight.configure({
      multicolor: true,
    }),
    // 文字样式：仅启用颜色与字号（字体/行高/背景色暂不暴露）
    TextStyleKit.configure({
      fontFamily: false,
      lineHeight: false,
      backgroundColor: false,
    }),
    Subscript,
    Superscript,
    Ruby,
    // 旧版 @ 提及节点（仅历史文档解析渲染，不触发 suggestion）
    createLegacyMentionExtension(),
    // 行内语义建议：@ 人物 / # 标签，选中插入纯文本
    createInlineSemanticSuggestExtension(),
    // 行内语义 Decoration：[[双链]] / #标签 / @人物 的 Logseq 风格渲染（纯视觉，不改文档结构）
    createInlineSemanticDecoration(),
    // 数学公式（行内 $...$ + 块级 $$...$$，KaTeX 渲染 + 点击编辑浮层）
    ...createMathematicsExtension(),
    TaskList,
    // 任务项：date 属性 + Vue NodeView（勾选切换 / 日期 chip 复用 pickDate）
    WrispTaskItem.configure({
      nested: true,
    }),
    Placeholder.configure({
      placeholder: placeholder || "",
    }),
    Markdown,
    // 提示块（`:::type` 围栏容器：斜杠插入、标题行/气泡菜单切换类型）
    Admonition,
    // 块拖拽排序：拖拽期间的蓝色插入线（落点指示）
    DropLine,
    // 自定义块（由声明式注册表生成的节点：卡片 atom + 可选分组容器）
    ...getBlocks().flatMap((def) => createBlockNodes(def)),
  ];

  // 内部去重：按扩展 name 去重，避免重复注册同名扩展
  function dedupeExtensions(e: Extensions): Extensions {
    const map = new Map<string, unknown>();
    for (const ex of e) {
      const name = getExtensionName(ex);
      if (!map.has(name)) {
        map.set(name, ex);
      }
    }
    return Array.from(map.values()) as Extensions;
  }

  return dedupeExtensions(exts);
}

/**
 * 获取扩展名称，兼容直接 name 属性与 options.name 两种来源
 */
function getExtensionName(ex: unknown): string {
  const ext = ex as Record<string, unknown> | null;
  const options = ext?.options as Record<string, unknown> | null;
  const name = typeof ext?.name === "string" ? ext.name : undefined;
  const optionName = typeof options?.name === "string" ? options.name : undefined;
  return name || optionName || String(ex);
}

/**
 * 创建编辑器扩展的工厂（公用接口）
 * - 返回去重后的扩展数组
 * - 可传入 `custom` 以在默认扩展后追加自定义扩展（并去重）
 */
export function createEditorExtensions(placeholder?: string, custom?: Extensions): Extensions {
  const base = getExtensions(placeholder);
  if (!custom || custom.length === 0) return base;
  const merged = [...base, ...custom];
  // 重用内部去重逻辑 from getExtensions by reusing function: recreate here
  const map = new Map<string, unknown>();
  for (const ex of merged) {
    const name = getExtensionName(ex);
    if (!map.has(name)) map.set(name, ex);
  }
  return Array.from(map.values()) as Extensions;
}