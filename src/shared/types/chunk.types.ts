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
