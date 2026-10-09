import { Id, Timestamp, Content } from "@/shared/types";

/**
 * journal_entries 行类型（日志真源）
 * attachments / metadata 为 JSON 文本列，序列化 / 反序列化归 Service，DAO 只见 TEXT。
 */
export interface JournalEntryRow {
  id: Id;
  date: string;
  occurred_at: Timestamp;
  source: string;
  type: string;
  content: Content;
  attachments: string | null;
  metadata: string | null;
  chunked_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: Timestamp | null;
}

export interface JournalEntryRowCreate {
  /** 显式传入时 BaseDao 保留（导入路径需确定性 id），缺省自动生成 UUID */
  id?: Id;
  date: string;
  occurred_at: Timestamp;
  source?: string;
  type?: string;
  content: Content;
  attachments?: string | null;
  metadata?: string | null;
  chunked_at?: Timestamp | null;
  created_at?: Timestamp;
  updated_at?: Timestamp;
  deleted_at?: Timestamp | null;
}

export interface JournalEntryRowUpdate {
  date?: string;
  occurred_at?: string;
  source?: string;
  type?: string;
  content?: Content;
  attachments?: string | null;
  metadata?: string | null;
  chunked_at?: string | null;
  deleted_at?: string | null;
  updated_at?: string;
}
