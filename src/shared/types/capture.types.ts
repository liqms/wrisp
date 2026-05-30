import {
  Id,
  Timestamp,
  Content,
  QueryParams,
  JsonMetadata,
  BooleanFlag,
} from "./base.types";
import {
  type ContentType,
  type CaptureSource,
  Locale as Language,
} from "@/shared/enums";

export type CaptureStatus = "active" | "split";

export interface CaptureInfo {
  id: Id;
  content: Content;
  content_type: ContentType;
  source: CaptureSource;
  language: Language;
  metadata: JsonMetadata;
  parent_record_id: Id | null;
  project_id: Id | null;
  split_index: number;
  is_memo: BooleanFlag;
  ai_summary: Content | null;
  temporal_score: number;
  word_count: number;
  status: CaptureStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface CaptureCreate {
  content: Content;
  content_type?: ContentType;
  source?: CaptureSource;
  metadata?: JsonMetadata;
  project_id?: Id | null;
  is_memo?: BooleanFlag;
}

export interface CaptureUpdate {
  id: Id;
  content?: Content;
  metadata?: JsonMetadata;
  project_id?: Id | null;
  is_memo?: BooleanFlag;
}

export interface CaptureQuery extends QueryParams {
  source?: CaptureSource;
  project_id?: Id | null;
  content_type?: ContentType;
  is_memo?: BooleanFlag;
  parent_record_id?: Id | null;
  temporal_score_min?: number;
  temporal_score_max?: number;
}

export interface CaptureListItem {
  id: Id;
  content: Content;
  content_type: ContentType;
  is_memo: BooleanFlag;
  temporal_score: number;
  word_count: number;
  status: CaptureStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface CaptureDetail extends CaptureInfo {
  children?: CaptureListItem[];
  parent?: CaptureListItem;
}

export interface CaptureDateListItem {
  date: Timestamp;
  captures: CaptureInfo[];
}
