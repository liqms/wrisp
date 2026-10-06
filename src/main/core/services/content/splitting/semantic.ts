import {
  CHUNK_EMBED_BATCH_SIZE,
  CHUNK_MAX_REFINE_SENTENCES,
  CHUNK_SEMANTIC_THRESHOLD_LOG,
  CHUNK_SEMANTIC_THRESHOLD_NARRATIVE,
} from "@/main/constants";
import { buildChunk, mergeTinyChunks } from "./block";
import { collectSentences, exceedsLengthLimit } from "./text";
import { packSentences } from "./length";
import type {
  CoarseBlock,
  Sentence,
  SentenceEmbedder,
  SplitChunk,
} from "./types";
import type { ChunkType } from "@/main/types/db";

/**
 * L3 语义边界优化：句子向量 → 相邻余弦相似度 → 在相似度**低谷**处切分。
 *
 * 只在 L2 被迫按长度切过的粗块上运行（那些块的边界是长度决定的、语义上是随机的），
 * 用真实的语义转折位置替换长度边界。向量由调用方注入，本模块不依赖模型是否就绪。
 */

/**
 * 阈值按体裁取：日志/技术类话题切换突兀（低谷明显，取高阈值 0.75），
 * 叙事/思考类话题渐变（低谷不明显，取低阈值 0.55，避免把一段连贯思考切断）。
 * Journal 以时间线条目为主，归入日志类；页面/反思/项目正文归入叙事类。
 */
export function thresholdForChunkType(chunkType: ChunkType): number {
  return chunkType === "journal"
    ? CHUNK_SEMANTIC_THRESHOLD_LOG
    : CHUNK_SEMANTIC_THRESHOLD_NARRATIVE;
}

/** 余弦相似度（向量应已归一化，仍按模长归一以防注入实现未归一化） */
function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embedInBatches(
  texts: string[],
  embedder: SentenceEmbedder,
): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += CHUNK_EMBED_BATCH_SIZE) {
    vectors.push(...(await embedder(texts.slice(i, i + CHUNK_EMBED_BATCH_SIZE))));
  }
  return vectors;
}

/**
 * 在相似度低谷处切分一个粗块。
 *
 * 返回 null 表示"不改"（保持 L2 结果）：句子太少不值得推理、超出推理上限、
 * 未发现低谷、或低谷恰好落在同一行内部（行是不可切分的定位单位）。
 * 低谷取 ±1 窗口内的局部最小值，避免把整段低于阈区的句子逐句切碎。
 */
export async function semanticSplit(
  block: CoarseBlock,
  embedder: SentenceEmbedder,
  threshold: number,
): Promise<SplitChunk[] | null> {
  const sentences = collectSentences(block);
  if (sentences.length < 3 || sentences.length > CHUNK_MAX_REFINE_SENTENCES) {
    return null;
  }

  const vectors = await embedInBatches(
    sentences.map((s) => s.text),
    embedder,
  );
  if (vectors.length !== sentences.length) return null;

  const sims: number[] = [];
  for (let i = 0; i + 1 < sentences.length; i++) {
    sims.push(cosine(vectors[i], vectors[i + 1]));
  }

  const groups: Sentence[][] = [];
  let group: Sentence[] = [sentences[0]];
  let cut = 0;

  for (let i = 0; i < sims.length; i++) {
    const isValley =
      sims[i] < threshold &&
      (i === 0 || sims[i] <= sims[i - 1]) &&
      (i === sims.length - 1 || sims[i] <= sims[i + 1]);
    const sameLine = sentences[i].endLine === sentences[i + 1].startLine;

    if (isValley && !sameLine) {
      groups.push(group);
      group = [sentences[i + 1]];
      cut += 1;
      continue;
    }
    group.push(sentences[i + 1]);
  }
  groups.push(group);

  if (cut === 0) return null;

  const chunks: SplitChunk[] = [];
  for (const group of groups) {
    const chunk = buildChunk(
      block,
      group[0].startLine,
      group[group.length - 1].endLine,
      "semantic",
    );
    // 语义连续但绝对长度仍超阈值：在语义段内部退化为句子装箱
    if (exceedsLengthLimit(chunk.content)) {
      chunks.push(...packSentences(block, group, "length"));
      continue;
    }
    chunks.push(chunk);
  }

  return mergeTinyChunks(chunks, block);
}
