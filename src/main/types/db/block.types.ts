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
  type CaptureSource,
  Locale as Language,
} from "@/shared/enums";

export type BlockId = Id;
export { ContentType, CaptureSource, type Language };

export type BlockStatus = "active" | "split";

export interface Block {
  id: BlockId;
  content: Content;
  content_type: ContentType;
  source: CaptureSource;
  language: Language;
  metadata: JsonMetadata;
  parent_block_id: BlockId | null;
  split_index: number;
  is_memo: BooleanFlag;
  is_archived: BooleanFlag;
  ai_summary: Content | null;
  temporal_score: number;
  word_count: number;
  status: BlockStatus;
  last_smart_processed_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface BlockCreate {
  id?: BlockId;
  content: Content;
  content_type?: ContentType;
  source?: CaptureSource;
  language?: Language;
  metadata?: JsonMetadata;
  parent_block_id?: BlockId | null;
  split_index?: number;
  ai_summary?: Content | null;
  is_memo?: BooleanFlag;
  is_archived?: BooleanFlag;
  temporal_score?: number;
  word_count?: number;
  status?: BlockStatus;
  last_smart_processed_at?: Timestamp | null;
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

export interface BlockUpdate {
  content?: Content;
  content_type?: ContentType;
  source?: CaptureSource;
  language?: Language;
  metadata?: JsonMetadata;
  parent_block_id?: BlockId | null;
  split_index?: number;
  is_memo?: BooleanFlag;
  is_archived?: BooleanFlag;
  ai_summary?: Content | null;
  temporal_score?: number;
  word_count?: number;
  status?: BlockStatus;
  last_smart_processed_at?: Timestamp | null;
  updated_at?: Timestamp;
}

export type StrictBlockCreate = Ensure<
  BlockCreate,
  {
    id: NonEmptyString<BlockId>;
    content: NonEmptyString<Content>;
  }
>;

export interface BlockQuery extends QueryParams {
  source?: CaptureSource;
  status?: BlockStatus;
  is_memo?: BooleanFlag;
  is_archived?: BooleanFlag;
  content_type?: ContentType;
  language?: Language;
  parent_block_id?: BlockId | null;
  temporal_score_min?: number;
  temporal_score_max?: number;
}

export interface BlockFts {
  rowid: number;
  content: Content;
  ai_summary: Content | null;
}
