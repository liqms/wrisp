import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { VueNodeViewRenderer } from "@tiptap/vue-3";
import { common, createLowlight } from "lowlight";
import CodeBlockView from "./CodeBlockView.vue";

/**
 * 共享 lowlight 实例：注册 common 语言集
 * （javascript/typescript/python/bash/go/rust/sql/yaml/json 等 37 种）。
 */
const lowlight = createLowlight(common);

/**
 * 代码块扩展工厂：
 * - 基于官方 CodeBlockLowlight（ProseMirror 装饰器实现编辑区实时语法高亮）
 * - 默认语言为 javascript
 * - 自定义 Vue NodeView 提供右上角悬浮工具栏（语言选择 + 复制）
 * - stopEvent / ignoreMutation 隔离工具栏交互，避免 ProseMirror 抢夺
 *   焦点导致下拉菜单一闪即关
 */
export function createCodeBlockLowlight() {
  return CodeBlockLowlight.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        language: {
          default: "javascript",
          parseHTML: (element) => {
            // marked 渲染的 HTML：<pre><code class="language-x">（class 在 code 子元素上）
            // 编辑器 getHTML 序列化：class 在 pre 自身（见下方 renderHTML），两处都要查
            const cls = [
              element.getAttribute("class"),
              element.firstElementChild?.getAttribute("class"),
            ]
              .filter(Boolean)
              .join(" ");
            const match = /language-(\w+)/.exec(cls);
            return match?.[1] ?? "javascript";
          },
          renderHTML: (attributes) => {
            if (!attributes.language) return {};
            return { class: `language-${attributes.language}` };
          },
        },
      };
    },
    addNodeView() {
      return VueNodeViewRenderer(CodeBlockView, {
        stopEvent: ({ event }) => {
          const target = event.target as HTMLElement | null;
          return Boolean(target?.closest?.(".code-block-toolbar"));
        },
        ignoreMutation: ({ mutation }) => {
          const target = mutation.target as Node | null;
          const el =
            target instanceof Element ? target : (target?.parentElement ?? null);
          if (!el) return true;
          if (el.closest(".code-block-toolbar")) return true;
          if (mutation.type === "selection") return false;
          return !el.closest("code");
        },
      });
    },
  }).configure({ lowlight });
}

export { lowlight };
