import { Mention } from "@tiptap/extension-mention";

/**
 * 旧版 @ 提及节点：仅保留历史文档的解析与渲染能力，
 * 不再挂载 suggestion 插件（新输入走 inline-semantic-suggest，插入纯文本）
 */
export function createLegacyMentionExtension() {
  return Mention.extend({
    addProseMirrorPlugins() {
      // 移除内置 suggestion 插件，避免与新扩展的 @ 触发冲突
      return [];
    },
  }).configure({
    HTMLAttributes: {
      class: "mention-node",
    },
  });
}
