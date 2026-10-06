import {
  CHUNK_MAX_COARSE_CHARS,
  CHUNK_SENTENCE_OVERLAP_RATIO,
} from "@/main/constants";
import {
  blockText,
  buildChunk,
  chunkFromSentences,
  mergeTinyChunks,
  spanText,
} from "./block";
import { splitStructure } from "./structure";
import { collectSentences, exceedsLengthLimit } from "./text";
import type {
  ChunkLayer,
  CoarseBlock,
  RefineTarget,
  Sentence,
  SplitChunk,
  SplitSegment,
} from "./types";

/**
 * L2 长度约束切分：把超阈值的粗块按句子边界装箱。
 *
 * 预算按**行区间还原出的正文**判定（`exceedsLengthLimit`：字符数上限），
 * 而不是按句子字符串长度累加——装箱口径与触发口径必须是同一个函数，
 * 否则 L3 精修出的块会立刻被重新判为超长、退回长度切分。
 *
 * 切分不会切进同一行内部：行是本项目定位语义块的最小单位。
 */

/** 该绝对行区间还原出的正文是否仍在预算内 */
function fitsSpan(
  block: CoarseBlock,
  startLine: number,
  endLine: number,
): boolean {
  return !exceedsLengthLimit(spanText(block, startLine, endLine));
}

/** 该句集合（首句起点到末句终点）是否仍在预算内 */
function fits(block: CoarseBlock, sentences: Sentence[]): boolean {
  return fitsSpan(
    block,
    sentences[0].startLine,
    sentences[sentences.length - 1].endLine,
  );
}

/** 单句仍超预算时按行硬切，保证块长度有上界 */
function enforceLineBudget(block: CoarseBlock, sentences: Sentence[]): Sentence[] {
  const out: Sentence[] = [];

  for (const sentence of sentences) {
    if (
      sentence.text.length <= CHUNK_MAX_COARSE_CHARS &&
      fits(block, [sentence])
    ) {
      out.push(sentence);
      continue;
    }

    let start = sentence.startLine;
    while (start <= sentence.endLine) {
      let end = start;
      // 首行无条件纳入：单行本身超预算时也只能整行成块（行不可切分）
      while (end < sentence.endLine && fitsSpan(block, start, end + 1)) {
        end += 1;
      }
      out.push({
        text: spanText(block, start, end),
        startLine: start,
        endLine: end,
      });
      start = end + 1;
    }
  }

  return out;
}

/** 上一块末尾有多少句子要作为重叠带进下一块 */
function overlapCarry(block: CoarseBlock, buffer: Sentence[]): Sentence[] {
  if (buffer.length < 2) return [];
  const count = Math.min(
    Math.max(1, Math.round(buffer.length * CHUNK_SENTENCE_OVERLAP_RATIO)),
    buffer.length - 1,
  );
  const carry = buffer.slice(-count);
  // 重叠本身就占满预算时不如不带，否则下一块装不进新内容
  return fits(block, carry) ? carry : [];
}

/** 按预算装箱句子，块间保留比例重叠 */
export function packSentences(
  block: CoarseBlock,
  sentences: Sentence[],
  layer: ChunkLayer,
): SplitChunk[] {
  const chunks: SplitChunk[] = [];
  let buffer: Sentence[] = [];

  for (const sentence of sentences) {
    // 同一行内的两句不可分居两块
    const sharesLine =
      buffer.length > 0 && sentence.startLine === buffer[buffer.length - 1].endLine;

    if (buffer.length > 0 && !sharesLine && !fits(block, [...buffer, sentence])) {
      const carry = overlapCarry(block, buffer);
      chunks.push(chunkFromSentences(block, buffer, layer));
      buffer = carry;
    }
    buffer.push(sentence);
  }

  if (buffer.length > 0) {
    chunks.push(chunkFromSentences(block, buffer, layer));
  }

  return mergeTinyChunks(chunks, block);
}

/**
 * 对 L1 粗块施加长度约束，产出按文档顺序排列的切分段。
 * 超阈值的文本块同时登记为 L3 精修目标（fallback 为本次 L2 结果）。
 */
export function applyLengthConstraint(blocks: CoarseBlock[]): SplitSegment[] {
  const segments: SplitSegment[] = [];

  for (const block of blocks) {
    // 自定义块围栏是原子单元：长度再长也不切，切碎了字段就散了
    if (block.kind === "fence") {
      segments.push({
        chunks: [buildChunk(block, block.startLine, block.endLine, "structure")],
        target: null,
      });
      continue;
    }

    if (!exceedsLengthLimit(blockText(block))) {
      segments.push({
        chunks: [buildChunk(block, block.startLine, block.endLine, "structure")],
        target: null,
      });
      continue;
    }

    const fallback = packSentences(
      block,
      enforceLineBudget(block, collectSentences(block)),
      "length",
    );
    const target: RefineTarget = { block, fallback };
    segments.push({ chunks: fallback, target });
  }

  return segments;
}

/** L1 + L2：零模型调用的完整切分 */
export function applyL1L2(markdown: string): SplitSegment[] {
  return applyLengthConstraint(splitStructure(markdown));
}
