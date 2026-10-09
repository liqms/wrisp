
/**
 * 搜索类型枚举
 * 用于标识搜索记录的类型
 */
export enum SEARCH_TYPE {
  /** 关键词搜索 */
  KEYWORD = "keyword",
  /** 语义搜索 */
  SEMANTIC = "semantic",
}

/**
 * 搜索类型联合类型
 * 从 SEARCH_TYPE 枚举派生，取枚举的值类型
 */
export type SearchType = (typeof SEARCH_TYPE)[keyof typeof SEARCH_TYPE];

// ───── 日志条目（journal_entries） ─────

/** 条目来源：桌面端录入 / 移动端录入 / 旧版整篇 .md 导入 */
export const JOURNAL_ENTRY_SOURCE = { DESKTOP: "desktop", MOBILE: "mobile", IMPORT: "import" } as const;
export type JournalEntrySource = (typeof JOURNAL_ENTRY_SOURCE)[keyof typeof JOURNAL_ENTRY_SOURCE];

/** 条目类型：文本 / 语音 / 图片 / 记账 / 待办 */
export const JOURNAL_ENTRY_TYPE = { TEXT: "text", VOICE: "voice", IMAGE: "image", EXPENSE: "expense", TASK: "task" } as const;
export type JournalEntryType = (typeof JOURNAL_ENTRY_TYPE)[keyof typeof JOURNAL_ENTRY_TYPE];