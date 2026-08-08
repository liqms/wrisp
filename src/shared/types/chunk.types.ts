import {
  Id,
  Timestamp,
  Content,
  QueryParams,
  JsonMetadata,
  BooleanFlag,
} from "./base.types";
import {
  Locale as Language,
} from "@/shared/enums";

export type ChunkStatus = "active" | "split";

export interface ChunkInfo {
  id: Id;
  content: Content;
  language: Language;
  metadata: JsonMetadata;
  parent_record_id: Id | null;
  project_id: Id | null;
  split_index: number;
  is_memo: BooleanFlag;
  ai_summary: Content | null;
  temporal_score: number;
  word_count: number;
  status: ChunkStatus;
  child_block_count: number;
  concept_count: number;
  topic_count: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ChunkCreate {
  content: Content;
  metadata?: JsonMetadata;
  project_id?: Id | null;
  is_memo?: BooleanFlag;
}

export interface ChunkUpdate {
  id: Id;
  content?: Content;
  metadata?: JsonMetadata;
  project_id?: Id | null;
  is_memo?: BooleanFlag;
}

export interface ChunkQuery extends QueryParams {
  project_id?: Id | null;
  is_memo?: BooleanFlag;
  parent_record_id?: Id | null;
  temporal_score_min?: number;
  temporal_score_max?: number;
}

export interface ChunkItem {
  id: Id;
  content: Content;
  is_memo: BooleanFlag;
  temporal_score: number;
  word_count: number;
  status: ChunkStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ChunkDetail extends ChunkInfo {
  children?: ChunkItem[];
  parent?: ChunkItem;
}

export interface ChunkDateItem {
  date: Timestamp;
  chunks: ChunkInfo[];
}