import {
  Id,
  Timestamp,
  Name,
  Content,
  JsonMetadata,
  QueryParams,
} from "./base.types";
import type { PageType } from "../enums";

// ───── 页面接口定义（前端使用） ─────

/** 页面状态 */
export type PageStatus = "active" | "deleted";

/** 页面信息 */
export interface PageInfo {
  id: Id;
  projectId: Id | null;
  parentId: Id | null;
  title: Name;
  content: Content;
  orderIndex: number;
  wordCount: number;
  summary: Content | null;
  metadata: JsonMetadata;
  status: PageStatus;
  pageType: PageType;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** 创建页面入参 */
export interface CreatePageInput {
  projectId: Id | null;
  title: Name;
  content: Content;
  parentId: Id | null;
  pageType: PageType;
  metadata?: JsonMetadata;
}

/** 修改页面入参 */
export interface UpdatePageInput {
  id: Id;
  title?: Name;
  content?: Content;
  status?: PageStatus;
  metadata?: JsonMetadata;
}

/** 移动页面入参（parentId 为 null 表示移到根） */
export interface MovePageInput {
  id: Id;
  parentId: Id | null;
}

/** 查询页面入参 */
export interface PageQuery extends QueryParams {
  projectId?: Id | null;
  parentId?: Id | null;
  status?: PageStatus;
  pageType?: PageType;
  title?: Name;
}

/** 页面树节点 */
export interface PageTreeNode extends PageInfo {
  children?: PageTreeNode[];
}

/** 目录条目（1-3 级标题） */
export interface PageCatalogItem {
  level: 1 | 2 | 3;
  text: string;
  /** 在文档中的位置，用于滚动定位 */
  pos: number;
}
