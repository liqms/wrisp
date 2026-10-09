import {
  Id,
  Timestamp,
  Content,
  QueryParams,
} from "./base.types";

export type ChunkStatus = "active" | "deleted";

export interface ChunkInfo {
  id: Id;
  content: Content;
  project_id: Id | null;
  ai_summary: Content | null;
  temporal_score: number;
  word_count: number;
  status: ChunkStatus;
  concept_count: number;
  topic_count: number;
  created_at: Timestamp;
  updated_at: Timestamp;
  /**
   * 结果层级：留空 = chunk 级（精确到块）；`"Page"` = 页级粗召回（定位到页）。
   * 页级结果由页面向量召回，content 取页面摘要。
   */
  kind?: "Page";
}

export interface ChunkCreate {
  content: Content;
  project_id?: Id | null;
}

export interface ChunkUpdate {
  id: Id;
  content?: Content;
  project_id?: Id | null;
}

export interface ChunkQuery extends QueryParams {
  project_id?: Id | null;
  temporal_score_min?: number;
  temporal_score_max?: number;
}

export interface ChunkItem {
  id: Id;
  content: Content;
  temporal_score: number;
  word_count: number;
  status: ChunkStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ChunkDateItem {
  date: Timestamp;
  chunks: ChunkInfo[];
}
