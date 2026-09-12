import type { BlockEmbeddingCreate } from "@/main/types/db/vector.types";

/**
 * 组装块向量写入载荷。
 * projectIdOf 用于解析每个块的作品归属（semantic_chunks 无 project_id，需外部提供）。
 */
export function buildBlockEmbeddings(
  batch: Array<{ id: string }>,
  vectors: number[][],
  projectIdOf: (blockId: string) => string | null,
): BlockEmbeddingCreate[] {
  return batch.map((block, idx) => ({
    block_id: block.id,
    project_id: projectIdOf(block.id),
    embedding: vectors[idx],
  }));
}
