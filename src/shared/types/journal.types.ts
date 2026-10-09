import {
  Id,
  Timestamp,
  Content,
  JsonMetadata,
} from "./base.types";
import type { JournalEntrySource, JournalEntryType } from "@/shared/enums/journal.enums";

// ───── 日志文件级类型（journal service 对外接口） ─────


/** 日志文件（来自 pages 表 + 文件系统） */
export interface JournalFileInfo {
  id: Id;
  date: string; // YYYY-MM-DD
  content: Content;
  metadata?: JsonMetadata;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** 创建日志文件参数 */
export interface JournalFileCreate {
  date: string; // YYYY-MM-DD
  content: Content;
  metadata?: JsonMetadata;
}

/** 更新日志文件参数 */
export interface JournalFileUpdate {
  id: Id;
  date: string; // YYYY-MM-DD
  content?: Content;
  metadata?: JsonMetadata;
}

/** 查询日志文件参数 */
export interface JournalFileQuery {
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

// ───── 日志条目级类型（journal_entries 为唯一事实源，对外接口） ─────

/** 单条日志条目（对应 journal_entries 行） */
export interface JournalEntry {
  id: Id;
  date: string;                      // YYYY-MM-DD（本地）
  occurred_at: Timestamp;            // UTC ISO
  source: JournalEntrySource;        // "desktop" | "mobile" | "import"
  type: JournalEntryType;            // "text" | "voice" | "image" | "expense" | "task"
  content: Content;                  // Markdown 正文（保留 #/&/@ 记号原文）
  attachments: string[] | null;      // workspace 相对路径（首版恒 null）
  metadata: Record<string, unknown> | null;
  chunked_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  deleted_at: Timestamp | null;
}

/** 条目关联的标签 / 作品（仅 id + 名称，供视图渲染） */
export interface JournalEntryBrief { id: Id; name: string }

/** 条目视图：attachments / metadata 不随列表下发 */
export interface JournalEntryView extends Omit<JournalEntry, "attachments" | "metadata"> {
  tags: JournalEntryBrief[];
  projects: JournalEntryBrief[];
}

/** 某一天的条目聚合视图 */
export interface JournalDayView {
  date: string;
  has_legacy_file: boolean;          // 当日无条目但存在旧版整篇 .md（导入入口显示条件）
  entries: JournalEntryView[];
}

/** 创建条目参数 */
export interface JournalEntryCreatePayload {
  content: Content;
  occurredAt?: Timestamp;            // 缺省 = 当前时刻
  source?: JournalEntrySource;
  type?: JournalEntryType;
  attachments?: string[];
  metadata?: Record<string, unknown>;
}

/** 更新条目参数 */
export interface JournalEntryUpdatePayload { id: Id; content?: Content; occurredAt?: Timestamp }

/** 旧版整篇 .md 拆条目结果 */
export interface JournalImportResult { imported: number; updated: number; skipped: number }

