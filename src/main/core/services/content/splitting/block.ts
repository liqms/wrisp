import { CHUNK_MIN_CHUNK_CHARS } from "@/main/constants";
import { NodeCryptoUtil } from "@/main/utils/crypto";
import { countWords, exceedsLengthLimit } from "./text";
import type { ChunkLayer, CoarseBlock, Sentence, SplitChunk } from "./types";

/** 粗块正文（原始 Markdown，保留行内格式） */
export function blockText(block: CoarseBlock): string {
  return block.lines.join("\n");
}

/** 行区间（闭区间，绝对行号）对应的原文 */
export function spanText(block: CoarseBlock, startLine: number, endLine: number): string {
  const from = Math.max(0, startLine - block.startLine);
  const to = Math.min(block.lines.length, endLine - block.startLine + 1);
  return block.lines.slice(from, to).join("\n");
}

/**
 * 按绝对行号区间（闭区间）从粗块构造语义块。
 *
 * 正文一律由**行区间**还原，而不是把切分出的片段重新拼接：
 * 这样 L2/L3 无论怎么切，块内容与原文逐行一致，
 * `start_line/end_line` 与正文也不会互相漂移（Wiki 侧靠行号回链原文）。
 */
export function buildChunk(
  block: CoarseBlock,
  startLine: number,
  endLine: number,
  layer: ChunkLayer,
): SplitChunk {
  const content = spanText(block, startLine, endLine);

  return {
    content,
    startLine,
    endLine,
    sectionTitle: block.sectionTitle,
    contentHash: NodeCryptoUtil.sha256(content),
    wordCount: countWords(content),
    layer,
  };
}

/** 由连续句子构造语义块（行区间取首句起点到末句终点） */
export function chunkFromSentences(
  block: CoarseBlock,
  sentences: Sentence[],
  layer: ChunkLayer,
): SplitChunk {
  return buildChunk(
    block,
    sentences[0].startLine,
    sentences[sentences.length - 1].endLine,
    layer,
  );
}

/**
 * 把过短的块并入前一块（行区间取并集）。
 *
 * 句子级切分很容易在段尾留下几十字的碎片块，它们既稀释检索权重，
 * 也让语义链接多出无意义节点；但合并不能把块顶出长度上限，
 * 因此只在并集仍满足 L2 上限时合并，否则保留碎片。
 */
export function mergeTinyChunks(
  chunks: SplitChunk[],
  block: CoarseBlock,
): SplitChunk[] {
  const merged: SplitChunk[] = [];

  for (const chunk of chunks) {
    const prev = merged[merged.length - 1];
    if (!prev || chunk.content.length >= CHUNK_MIN_CHUNK_CHARS) {
      merged.push(chunk);
      continue;
    }
    const combined = buildChunk(block, prev.startLine, chunk.endLine, prev.layer);
    if (!exceedsLengthLimit(combined.content)) {
      merged[merged.length - 1] = combined;
    } else {
      merged.push(chunk);
    }
  }

  return merged;
}
