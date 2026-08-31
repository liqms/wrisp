import { Node, mergeAttributes, type JSONContent } from "@tiptap/core";

/**
 * Ruby 注音扩展
 *
 * 结构：<ruby>正文<rt>注音</rt></ruby>，用于汉字拼音、日文假名等注音标注。
 * Markdown 序列化时以内联 HTML 形式保存，读取时经 marked 的 html token
 * 解析链路还原为 ruby 节点（依赖下方 parseHTML 规则）。
 */

export interface RubyOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    ruby: {
      /** 用 ruby 节点包裹选中文本并写入注音 */
      setRuby: (annotation: string) => ReturnType;
      /** 移除光标所在的 ruby 节点（保留正文文本） */
      unsetRuby: () => ReturnType;
    };
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const Ruby = Node.create<RubyOptions>({
  name: "ruby",
  inline: true,
  group: "inline",
  content: "text*",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      annotation: {
        default: "",
        parseHTML: (element) => element.querySelector("rt")?.textContent ?? "",
        // 注音经 rt 子元素渲染，不落在 ruby 标签属性上
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "ruby" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "ruby",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
      ["rt", {}, node.attrs.annotation as string],
    ];
  },

  renderMarkdown(node: JSONContent) {
    const text = escapeHtml(node.content?.map((c) => c.text ?? "").join("") ?? "");
    const annotation = escapeHtml((node.attrs?.annotation as string) ?? "");
    return `<ruby>${text}<rt>${annotation}</rt></ruby>`;
  },

  addCommands() {
    return {
      setRuby:
        (annotation: string) =>
        ({ chain, state }) => {
          const { from, to } = state.selection;
          const text = state.doc.textBetween(from, to, "");
          const content: JSONContent[] = text ? [{ type: "text", text }] : [];
          return chain()
            .insertContentAt(
              { from, to },
              {
                type: this.name,
                attrs: { annotation },
                content,
              },
            )
            .run();
        },
      unsetRuby:
        () =>
        ({ chain, state }) => {
          const { $from } = state.selection;
          for (let depth = $from.depth; depth >= 1; depth--) {
            const node = $from.node(depth);
            if (node.type.name !== this.name) continue;
            const start = $from.before(depth);
            const end = $from.after(depth);
            const text = node.textContent;
            if (!text) {
              return chain().deleteRange({ from: start, to: end }).run();
            }
            return chain()
              .insertContentAt({ from: start, to: end }, { type: "text", text })
              .run();
          }
          return false;
        },
    };
  },
});
