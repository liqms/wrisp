import {
  Id,
  Timestamp,
  Ensure,
  NonEmptyString,
  QueryParams,
  JsonMetadata,
  Content,
  BooleanFlag,
} from "@/shared/types";
import {
  type ContentType,
  type JournalSource,
  Locale as Language,
} from "@/shared/enums";

export type ChunkId = Id;
export { ContentType, JournalSource, type Language };

export type ChunkStatus = "active" | "split";

export interface Chunk {
  id: ChunkId;
  content: Content;
  content_type: ContentType;
  source: JournalSource;
  language: Language;
  metadata: JsonMetadata;
  parent_chunk_id: ChunkId | null;
  split_index: number;
  is_memo: BooleanFlag;
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
  content_type?: ContentType;
  source?: JournalSource;
  language?: Language;
  metadata?: JsonMetadata;
  parent_chunk_id?: ChunkId | null;
  split_index?: number;
  ai_summary?: Content | null;
  is_memo?: BooleanFlag;
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
  content_type?: ContentType;
  source?: JournalSource;
  language?: Language;
  metadata?: JsonMetadata;
  parent_chunk_id?: ChunkId | null;
  split_index?: number;
  is_memo?: BooleanFlag;
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
  source?: JournalSource;
  status?: ChunkStatus;
  is_memo?: BooleanFlag;
  is_deleted?: BooleanFlag;
  content_type?: ContentType;
  language?: Language;
  parent_chunk_id?: ChunkId | null;
  temporal_score_min?: number;
  temporal_score_max?: number;
}

export interface ChunkFts {
  rowid: number;
  content: Content;
  ai_summary: Content | null;
}