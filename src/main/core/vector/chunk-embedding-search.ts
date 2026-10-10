import type { Table } from "@lancedb/lancedb";
import { buildProjectFilter } from "./project-filter";
import type { ChunkEmbedding } from "@/main/types/db/vector.types";

/**
 * 语义搜索 Chunk 向量。
 * 传入 projectId 时按作品过滤——检索必须按作品隔离。
 */
export async function searchChunkEmbeddings(
  table: Table,
  queryVector: number[],
  topK: number = 10,
  projectId?: string,
): Promise<ChunkEmbedding[]> {
  const search = table.search(queryVector);
  const filtered = projectId
    ? search.where(buildProjectFilter(projectId))
    : search;
  const results = await filtered.limit(topK).toArray();
  return results as ChunkEmbedding[];
}
