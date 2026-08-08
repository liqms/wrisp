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
  isContainer: boolean;
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
  content?: Content;
  status?: PageStatus;
  metadata?: JsonMetadata;
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
