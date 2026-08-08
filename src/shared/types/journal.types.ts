import {
  Id,
  Timestamp,
  Content,
  JsonMetadata,
} from "./base.types";

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

