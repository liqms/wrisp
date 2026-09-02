import { Node } from "@tiptap/core";
import type { Extensions } from "@tiptap/core";
import { VueNodeViewRenderer } from "@tiptap/vue-3";
import type { WrispBlockDefinition, WrispBlockField } from "../registry";
import { sanitizeFieldValue, sanitizeAttrs, serializeFence, kebabCase } from "./md-codec";

/**
 * 节点工厂：由块定义生成 Tiptap 节点扩展。
 * - 卡片节点：atom（字段全在 attrs，弹窗编辑），renderMarkdown 输出 `:::name` 约定语法
 * - 分组节点（可选）：连续围栏归组的容器，renderMarkdown 用 renderChildren 序列化子卡片
 */

/** 卡片节点的 data 属性名：data-f-<kebab(key)> */
function dataAttrName(field: WrispBlockField): string {
  return `data-f-${kebabCase(field.key)}`;
}

export function createBlockNodes(def: WrispBlockDefinition): Extensions {
  const nodes: Extensions = [];

  // 卡片节点（数据型原子块）
  nodes.push(
    Node.create({
      name: def.type,
      group: "block",
      atom: true,
      selectable: true,

      addAttributes() {
        const attrs: Record<string, { default: string; parseHTML: (element: HTMLElement) => string }> = {};
        for (const field of def.fields) {
          attrs[field.key] = {
            default: String(field.default),
            parseHTML: (element: HTMLElement) =>
              sanitizeFieldValue(element.getAttribute(dataAttrName(field)), field),
          };
        }
        return attrs;
      },

      parseHTML() {
        return [{ tag: `div[data-wrisp-block="${def.type}"]` }];
      },

      renderHTML({ node }) {
        const htmlAttrs: Record<string, string> = { "data-wrisp-block": def.type };
        const clean = sanitizeAttrs(node.attrs, def.fields);
        for (const field of def.fields) {
          htmlAttrs[dataAttrName(field)] = clean[field.key];
        }
        return ["div", htmlAttrs];
      },

      renderMarkdown(node) {
        return serializeFence(def.mdName, node.attrs ?? {}, def.fields);
      },

      addNodeView() {
        return VueNodeViewRenderer(def.cardView);
      },
    }),
  );

  // 分组容器节点（声明 groupView 时启用）
  if (def.groupView) {
    nodes.push(
      Node.create({
        name: `${def.type}Group`,
        group: "block",
        content: `${def.type}*`,
        defining: true,

        parseHTML() {
          return [{ tag: `div[data-wrisp-block-group="${def.type}"]` }];
        },

        renderHTML() {
          return ["div", { "data-wrisp-block-group": def.type }, 0];
        },

        renderMarkdown(node, helpers) {
          if (!node.content) return "";
          return helpers.renderChildren(node.content, "\n");
        },

        addNodeView() {
          return VueNodeViewRenderer(def.groupView!);
        },
      }),
    );
  }

  return nodes;
}
