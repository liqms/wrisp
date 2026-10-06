import { Logger } from "@/main/utils/logger";
import { applyL1L2 } from "./splitting/length";
import { semanticSplit, thresholdForChunkType } from "./splitting/semantic";
import type {
  SentenceEmbedder,
  SplitChunk,
  SplitResult,
  SplitSegment,
} from "./splitting/types";

/**
 * 语义块分层切分
 *
 * | 层级 | 触发 | 方法 | 成本 |
 * | --- | --- | --- | --- |
 * | L1 结构感知 | 始终 | 标题 / 独立时间戳行 / `:::` 围栏（代码围栏内不识别） | 零，毫秒级 |
 * | L2 长度约束 | 粗块 > 500 字符 | 句子边界装箱 + 15% 句子重叠 | 极低 |
 * | L3 语义边界 | L2 被迫按长度切过的块 | 句子向量相邻余弦相似度低谷处切分 | 中，需本地嵌入模型 |
 *
 * L1/L2 在 `file:chunk` 任务内同步完成（不调模型）；L3 由独立的 `file:chunk-refine`
 * 任务异步精修，模型不可用时自动跳过并保留 L2 结果——保存路径永远不等推理。
 *
 * L4 延迟分块（先编码全文再按边界池化 token 向量）暂未实现，接口已就位：
 * `SentenceEmbedder` 就是它的注入点（换成 token 级向量来源 + 本文件的分段结果即可），
 * 上限常量见 `CHUNK_LATE_CHUNKING_MAX_TOKENS`。
 */

export type {
  ChunkLayer,
  CoarseBlock,
  RefineTarget,
  SentenceEmbedder,
  SplitChunk,
  SplitResult,
  SplitSegment,
} from "./splitting/types";
export { thresholdForChunkType };

/** 按文档顺序展平切分段 */
export function collectChunks(segments: SplitSegment[]): SplitChunk[] {
  return segments.flatMap((segment) => segment.chunks);
}

/** L1 + L2 切分（零模型调用），同时给出需要 L3 精修的块 */
export function splitDocument(markdown: string): SplitResult {
  const segments = applyL1L2(markdown);
  return {
    segments,
    stats: {
      coarse: segments.length,
      refined: segments.filter((segment) => segment.target !== null).length,
    },
  };
}

/** 是否存在需要 L3 语义精修的粗块 */
export function hasRefineTargets(result: SplitResult): boolean {
  return result.segments.some((segment) => segment.target !== null);
}

/**
 * 对每个待精修块运行 L3，用语义低谷边界替换长度边界。
 *
 * 逐段降级：某块推理失败或未发现低谷时保留它的 L2 结果，
 * 其余块照常精修——一次模型抖动不该让整个文件的切分回退。
 */
export async function refineDocument(
  result: SplitResult,
  embedder: SentenceEmbedder,
  threshold: number,
): Promise<SplitChunk[]> {
  const chunks: SplitChunk[] = [];

  for (const segment of result.segments) {
    if (!segment.target) {
      chunks.push(...segment.chunks);
      continue;
    }

    try {
      const refined = await semanticSplit(segment.target.block, embedder, threshold);
      chunks.push(...(refined ?? segment.chunks));
    } catch (error) {
      Logger.warn("[ChunkSplitter] 语义精修失败，保留长度切分结果", {
        blockStartLine: segment.target.block.startLine,
        error: String(error),
      });
      chunks.push(...segment.chunks);
    }
  }

  return chunks;
}

/**
 * L1 + L2 便捷入口（与历史签名一致）。
 * 需要 L3 时改用 splitDocument + refineDocument。
 */
export function splitMarkdown(markdown: string): SplitChunk[] {
  return collectChunks(splitDocument(markdown).segments);
}
