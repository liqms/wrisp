/**
 * Block内容类型枚举
 * 用于标识Block的内容格式
 */
export enum CONTENT_TYPE {
  /** 灵感内容 */
  INSIGHT = "insight",
  /** 待办事项 */
  TODO = "todo",
  /** 日记 */
  DAILY = "daily",
  /** 笔记 */
  NOTE = "note",
}

/**
 * 内容类型联合类型
 * 从 CONTENT_TYPE 枚举派生，取枚举的值类型
 */
export type ContentType = (typeof CONTENT_TYPE)[keyof typeof CONTENT_TYPE];

/**
 * Block来源枚举
 * 用于标识Block的创建方式
 */
export enum CAPTURE_SOURCE {
  /** 手动输入 */
  MANUAL = "manual",
  /** 语音输入 */
  VOICE = "voice",
  /** 文件导入 */
  IMPORT = "import",
  /** 智能拆分生成 */
  SPLIT = "split",
}

/**
 * 用于标识Block的创建方式
 */
export type CaptureSource =
  (typeof CAPTURE_SOURCE)[keyof typeof CAPTURE_SOURCE];

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
