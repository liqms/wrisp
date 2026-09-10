import type { OutlineNode } from "@/shared/types";

/** 无序列表（- * +）与有序列表（1. / 1)） */
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;

/**
 * 把模型产出的大纲文本解析为节点数组。
 *
 * - 只认列表项，忽略标题行/空行/说明文字；
 * - `标题：摘要` 形式会拆出摘要（中英文冒号均可）；
 * - 解析不出内容时返回空数组，而不是抛错（调用方据此决定是否降级）。
 */
export function parseOutline(markdown: string): OutlineNode[] {
  const nodes: OutlineNode[] = [];

  for (const line of markdown.split(/\r?\n/)) {
    const match = LIST_ITEM.exec(line);
    if (!match) continue;

    const body = match[1].trim();
    if (!body) continue;

    const sepIndex = body.search(/[:：]/);
    const title = sepIndex >= 0 ? body.slice(0, sepIndex).trim() : body;
    const summary = sepIndex >= 0 ? body.slice(sepIndex + 1).trim() : "";
    if (!title) continue;

    nodes.push({
      id: `on_${nodes.length + 1}_${Date.now().toString(36)}`,
      title,
      summary,
      status: "pending",
    });
  }

  return nodes;
}
