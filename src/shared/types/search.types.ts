
/** 搜索结果类型 */
export type SearchResultType = "chunk" | "concept" | "topic" | "project" | "page";

/** 统一搜索结果（覆盖语义块/概念/主题/作品/页面五类数据源） */
export interface SearchResult {
  type: SearchResultType;
  id: string;
  /** 显示标题 */
  title: string;
  /** 内容摘要/片段 */
  content: string;
  /** 创建时间 */
  createdAt?: string;
  /** 更新时间 */
  updatedAt?: string;
  /** 关联作品 ID（页面/语义块适用） */
  projectId?: string;
  /** 页面类型（页面适用） */
  pageType?: string;
}
