import { Id } from "@/shared/types";

export type EmbeddingId = Id;

export type EmbeddingVector = number[];

export type VectorTableName = "block_embeddings" | "pages_embeddings";

/**
 * Block 向量数据
 */
export interface BlockEmbedding {
  [key: string]: unknown;
  block_id: Id;
  embedding: EmbeddingVector;
  _distance?: number;
}

/**
 * 页面向量数据
 */
export interface PageEmbedding {
  [key: string]: unknown;
  page_id: Id;
  project_id: Id;
  embedding: EmbeddingVector;
  _distance?: number;
}

/**
 * 向量搜索结果
 */
export interface VectorSearchResult<T> {
  item: T;
  score: number;
  distance?: number;
}

/**
 * 向量搜索参数
 */
export interface VectorSearchParams {
  vector: EmbeddingVector;
  topK?: number;
  table?: VectorTableName;
  projectId?: Id;
}

/**
 * Block 向量创建参数
 */
export interface BlockEmbeddingCreate {
  block_id: Id;
  embedding: EmbeddingVector;
}

/**
 * Block 向量更新参数
 */
export interface BlockEmbeddingUpdate {
  embedding: EmbeddingVector;
}

/**
 * 页面向量创建参数
 */
export interface PageEmbeddingCreate {
  page_id: Id;
  project_id: Id;
  embedding: EmbeddingVector;
}

/**
 * 页面向量更新参数
 */
export interface PageEmbeddingUpdate {
  embedding: EmbeddingVector;
}

/**
 * 批量向量创建参数
 */
export interface BatchEmbeddingCreate<T> {
  items: T[];
}

/**
 * 向量统计信息
 */
export interface VectorStats {
  tableName: VectorTableName;
  rowCount: number;
  dimension: number;
  indexed: boolean;
}
