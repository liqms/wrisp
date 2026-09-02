import Image from "@tiptap/extension-image";
import { VueNodeViewRenderer } from "@tiptap/vue-3";
import ImageView from "./ImageView.vue";

/**
 * 图片扩展（基于官方 Image 扩展）：
 * - 新增 width（像素数字，默认 null 即原始尺寸）、align（left/center/right，默认 null 即跟随段落）属性
 * - 自定义 Vue NodeView：
 *   - 选中图片时显示右下角缩放手柄，拖拽手柄按比例调整宽度（持久化到 width 属性）
 *   - 对齐通过容器 text-align 实现
 *   - stopEvent/ignoreMutation 隔离手柄与浮层交互，避免 ProseMirror 抢夺焦点
 * - 宽度下限 40px，上限 1600px
 */
export function createImageExtension() {
  return Image.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        // 空字符串视为无描述（null）；"" 仅在编辑会话内部短暂使用，不入文档
        alt: {
          default: null,
          parseHTML: (element) => {
            const v = element.getAttribute("alt");
            return v === "" || v == null ? null : v;
          },
        },
        width: {
          default: null,
          parseHTML: (element) => {
            const w = element.getAttribute("width");
            if (w) {
              const n = Number(w);
              if (Number.isFinite(n) && n > 0) return n;
            }
            const style = element.getAttribute("style") ?? "";
            const m = /width:\s*(\d+(?:\.\d+)?)px/.exec(style);
            if (m) {
              const n = Number(m[1]);
              if (Number.isFinite(n) && n > 0) return n;
            }
            return null;
          },
          renderHTML: (attrs) => {
            if (!attrs.width) return {};
            return { width: String(Math.round(attrs.width)), style: `width:${Math.round(attrs.width)}px` };
          },
        },
        align: {
          default: null,
          parseHTML: (element) => {
            const cls = element.getAttribute("class") ?? "";
            if (/\bimage-align-(left|center|right)\b/.test(cls)) {
              return RegExp.$1;
            }
            const parent = element.parentElement;
            if (parent && parent.tagName === "P") {
              const ta = parent.style.textAlign || getComputedStyle(parent).textAlign;
              if (ta === "center" || ta === "right") return ta;
            }
            return null;
          },
          renderHTML: (attrs) => {
            if (!attrs.align) return {};
            return { class: `image-align-${attrs.align}` };
          },
        },
      };
    },
    // 覆盖官方 renderMarkdown（仅输出 ![alt](src)，丢失 width/align）：
    // 带尺寸/对齐时序列化为 HTML img 标签，配合上方 parseHTML 完成往返；
    // 不带附加属性时保持标准 markdown 图片语法，保证文档可移植
    renderMarkdown: (node) => {
      const src = String(node.attrs?.src ?? "");
      const alt = String(node.attrs?.alt ?? "");
      const title = node.attrs?.title ? String(node.attrs.title) : "";
      const width = node.attrs?.width;
      const align =
        node.attrs?.align === "left" || node.attrs?.align === "center" || node.attrs?.align === "right"
          ? (node.attrs.align as string)
          : "";

      if (!(typeof width === "number" && width > 0) && !align) {
        return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
      }

      const esc = (v: string) =>
        v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      let tag = `<img src="${esc(src)}"`;
      if (alt) tag += ` alt="${esc(alt)}"`;
      if (title) tag += ` title="${esc(title)}"`;
      if (typeof width === "number" && width > 0) tag += ` width="${Math.round(width)}"`;
      if (align) tag += ` class="image-align-${align}"`;
      tag += ">";
      return tag;
    },
    addNodeView() {
      return VueNodeViewRenderer(ImageView, {
        stopEvent: ({ event }) => {
          const target = event.target as HTMLElement | null;
          // 缩放手柄 / 图片描述（caption 输入框）的交互全部交给 Vue NodeView 处理，
          // 阻止 ProseMirror 抢夺焦点或吞掉按键
          return Boolean(
            target?.closest?.(".image-resize-handle") || target?.closest?.(".image-caption"),
          );
        },
        ignoreMutation: ({ mutation }) => {
          // 图片是叶子节点（无 contentDOM），DOM 全部由 Vue NodeView 管理：
          // 除 selection 外的所有 mutation 都必须忽略，否则 ProseMirror 会把
          // Vue 的 DOM 更新当作用户编辑处理，导致 view 更新崩溃、整篇文档渲染失败
          if (mutation.type === "selection") return false;
          return true;
        },
      });
    },
  }).configure({
    inline: false,
    allowBase64: true,
  });
}

/** 图片宽度上下限（px） */
export const IMAGE_WIDTH_MIN = 40;
export const IMAGE_WIDTH_MAX = 1600;
