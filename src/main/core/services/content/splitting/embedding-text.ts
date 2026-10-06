import { fenceToEmbeddingText, isFenceContent, parseFence } from "./fence";

export interface EmbeddableChunk {
  content: string;
  ai_summary: string | null;
}

/**
 * 语义块 → 送去嵌入的文本。
 *
 * `:::` 自定义块走**字段拼装**：卡片正文本身就是 `key: value` 行，
 * 拼成 `metric: label DAU, value 12k` 后指标名与数值同处一条向量，
 * 问「DAU 多少」可以直接命中卡片。这类块跳过 ai_summary——
 * 让模型复述一张卡片只会稀释字段权重。
 * 普通文本块沿用摘要优先（摘要比正文更贴近"这块在讲什么"）。
 */
export function buildEmbeddingText(chunk: EmbeddableChunk): string {
  if (isFenceContent(chunk.content)) {
    const fence = parseFence(chunk.content.split(/\r?\n/));
    if (fence) return fenceToEmbeddingText(fence);
  }
  return chunk.ai_summary || chunk.content;
}
