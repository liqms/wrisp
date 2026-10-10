import type {
  ChunkEmbeddingCreate,
  PageEmbeddingCreate,
} from "@/main/types/db/vector.types";

/**
 * 组装块向量写入载荷。
 * projectIdOf 用于解析每个块的作品归属（semantic_chunks 无 project_id，需外部提供）。
 */
export function buildChunkEmbeddings(
  batch: Array<{ id: string }>,
  vectors: number[][],
  projectIdOf: (chunkId: string) => string | null,
): ChunkEmbeddingCreate[] {
  return batch.map((chunk, idx) => ({
    chunk_id: chunk.id,
    project_id: projectIdOf(chunk.id),
    embedding: vectors[idx],
  }));
}

/**
 * 页面 → 送去嵌入的文本。
 * 摘要优先（它比标题更贴近「这一页在讲什么」）；尚未生成摘要时退回标题。
 */
export function buildPageEmbeddingText(page: {
  title: string;
  ai_summary: string | null;
}): string {
  return page.ai_summary?.trim() || page.title;
}

/**
 * 组装页面向量写入载荷。
 * 作品归属直接取 pages.project_id（可空，页面可不属于任何作品）。
 */
export function buildPageEmbeddings(
  batch: Array<{ id: string; project_id: string | null }>,
  vectors: number[][],
): PageEmbeddingCreate[] {
  return batch.map((page, idx) => ({
    page_id: page.id,
    project_id: page.project_id,
    embedding: vectors[idx],
  }));
}
