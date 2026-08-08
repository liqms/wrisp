
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