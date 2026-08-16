import {
  Id,
  Timestamp,
  Ensure,
  NonEmptyString,
  QueryParams,
  Content,
  BooleanFlag,
} from "@/shared/types";

export type ChunkId = Id;

export type ChunkStatus = "active" | "deleted";

export interface Chunk {
  id: ChunkId;
  content: Content;
  is_deleted: BooleanFlag;
  ai_summary: Content | null;
  temporal_score: number;
  word_count: number;
  status: ChunkStatus;
  last_smart_processed_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ChunkCreate {
  id?: ChunkId;
  content: Content;
  ai_summary?: Content | null;
  is_deleted?: BooleanFlag;
  temporal_score?: number;
  word_count?: number;
  status?: ChunkStatus;
  last_smart_processed_at?: Timestamp | null;
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

export interface ChunkUpdate {
  content?: Content;
  is_deleted?: BooleanFlag;
  ai_summary?: Content | null;
  temporal_score?: number;
  word_count?: number;
  status?: ChunkStatus;
  last_smart_processed_at?: Timestamp | null;
  updated_at?: Timestamp;
}

export type StrictChunkCreate = Ensure<
  ChunkCreate,
  {
    id: NonEmptyString<ChunkId>;
    content: NonEmptyString<Content>;
  }
>;

export interface ChunkQuery extends QueryParams {
  status?: ChunkStatus;
  is_deleted?: BooleanFlag;
  temporal_score_min?: number;
  temporal_score_max?: number;
}

export interface ChunkFts {
  rowid: number;
  content: Content;
  ai_summary: Content | null;
}
