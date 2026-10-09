import {
  Id,
  Timestamp,
  Ensure,
  NonEmptyString,
  QueryParams,
  Content,
  BooleanFlag,
  FilePath,
  HashValue,
} from "@/shared/types";

export type ChunkId = Id;

export type ChunkStatus = "active" | "deleted";

/** 语义块来源类型 */
export type ChunkType = "journal" | "project" | "page" | "reflection";

export interface Chunk {
  id: ChunkId;
  /** 所属文件索引 ID（file_index.id） */
  file_id: Id;
  /** 来源文件路径（工作空间相对路径） */
  file_path: FilePath;
  /** 起始行号（1-based，闭区间） */
  start_line: number;
  /** 结束行号（1-based，闭区间） */
  end_line: number;
  /** 所属小节标题（Markdown 标题，无标题时为 null） */
  section_title: string | null;
  content: Content;
  /** 内容哈希，用于判断块内容是否变化 */
  content_hash: HashValue | null;
  /** 来源类型 */
  chunk_type: ChunkType;
  is_deleted: BooleanFlag;
  ai_summary: Content | null;
  temporal_score: number;
  word_count: number;
  status: ChunkStatus;
  /**
   * 最近一次跑完摘要阶段的时间（chunk-summary 的专用标记）。
   * 与 `ai_summary` 是否有值无关：判为「无正文可摘要」的块不写摘要，
   * 但会写这个标记，于是下一轮不再被选中（否则每轮重扫整库非文字块）。
   */
  last_summary_generated_at: Timestamp | null;
  /**
   * 最后被任一智能任务触碰的时间，仅作观测。
   * 增量选取请用各阶段自己的标记列 —— 三任务共写一列时它代表「最后写的那个」。
   */
  last_smart_processed_at: Timestamp | null;
  /** 最近一次完成向量化的时间；null 表示尚未写入向量库（chunk-vectorize 的专用标记） */
  last_vectorized_at: Timestamp | null;
  /** 最近一次完成概念抽取的时间（concept-extract 的专用标记） */
  last_concept_extracted_at: Timestamp | null;
  /** 最近一次建立语义链接的时间（semantic-link 的专用标记） */
  last_linked_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ChunkCreate {
  id?: ChunkId;
  /** 所属文件索引 ID（semantic_chunks.file_id 为 NOT NULL） */
  file_id: Id;
  /** 来源文件路径（semantic_chunks.file_path 为 NOT NULL） */
  file_path: FilePath;
  /** 起始行号（semantic_chunks.start_line 为 NOT NULL） */
  start_line: number;
  /** 结束行号（semantic_chunks.end_line 为 NOT NULL） */
  end_line: number;
  section_title?: string | null;
  content: Content;
  content_hash?: HashValue | null;
  chunk_type?: ChunkType;
  ai_summary?: Content | null;
  is_deleted?: BooleanFlag;
  temporal_score?: number;
  word_count?: number;
  status?: ChunkStatus;
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

/**
 * 语义块的可更新字段。
 *
 * 阶段标记列（`last_summary_generated_at` / `last_smart_processed_at` /
 * `last_vectorized_at` / `last_concept_extracted_at` / `last_linked_at`）
 * 有意不在此列：它们只能由
 * `ChunkDao.recordStage()` 写，因为 `update()` 会连带刷新 `updated_at`，
 * 而智能任务正是用 `updated_at > 标记列` 判定增量 —— 写标记顶高水位线会让
 * 同一块每轮被自己重新选中。
 */
export interface ChunkUpdate {
  /** 所属文件索引 ID */
  file_id?: Id;
  /** 来源文件相对路径 */
  file_path?: FilePath;
  /** 起始行号（1-based，闭区间） */
  start_line?: number;
  /** 结束行号（1-based，闭区间） */
  end_line?: number;
  /** 所属小节标题 */
  section_title?: string | null;
  /** 来源类型 */
  chunk_type?: ChunkType;
  content?: Content;
  /** 内容哈希 */
  content_hash?: HashValue | null;
  is_deleted?: BooleanFlag;
  ai_summary?: Content | null;
  temporal_score?: number;
  word_count?: number;
  status?: ChunkStatus;
  updated_at?: Timestamp;
}

/**
 * 按文件差异同步语义块的结果。
 *
 * `removedIds` 是正文已从文件中消失、其派生数据（向量）需要一并清理的块；
 * 复用 id 的块不在其中——它们的摘要与向量仍然对应同一正文。
 */
export interface ChunkSyncResult {
  /** 正文未变、复用原 id 的块数（摘要 / 向量 / 作品归属因此保留） */
  reused: number;
  /** 新写入的块数 */
  inserted: number;
  /** 本次消失的块 id */
  removedIds: ChunkId[];
  /** 同步后的块总数（等于传入的块数） */
  total: number;
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
