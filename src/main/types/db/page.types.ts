import { Id, Timestamp, Ensure, NonEmptyString, Name, Content, QueryParams, JsonMetadata } from '@/shared/types'
import type { PageType } from '@/shared/enums'

export type PageId = Id

export type PageStatus = 'active' | 'deleted'

export interface Page {
  id: PageId
  project_id: Id | null
  title: Name
  content?: Content | null
  file_path: string
  order_index: number
  parent_page_id: PageId | null
  word_count: number
  ai_summary: Content | null
  metadata: JsonMetadata
  status: PageStatus
  page_type: PageType
  /** 页面级分阶段处理标记：只作观测值，增量选取看各自的阶段列 */
  last_smart_processed_at: Timestamp | null
  /** page-summary 专用：页面摘要已生成 */
  last_summary_generated_at: Timestamp | null
  /** page-vectorize 专用：页面向量已写入 */
  last_vectorized_at: Timestamp | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface PageCreate {
  id?: PageId
  project_id?: Id | null
  title: Name
  file_path: string
  content?: Content | null
  order_index?: number
  parent_page_id?: PageId | null
  word_count?: number
  ai_summary?: Content | null
  metadata?: JsonMetadata
  status?: PageStatus
  page_type?: PageType
  created_at?: Timestamp
  updated_at?: Timestamp
}

export interface PageUpdate {
  project_id?: Id | null
  title?: Name
  file_path?: string
  content?: Content | null
  order_index?: number
  parent_page_id?: PageId | null
  word_count?: number
  ai_summary?: Content | null
  metadata?: JsonMetadata
  status?: PageStatus
  updated_at?: Timestamp
}

export type StrictPageCreate = Ensure<PageCreate, {
  id: NonEmptyString<PageId>
  title: NonEmptyString<Name>
  file_path: NonEmptyString<string>
}>

export interface PageQuery extends QueryParams {
  project_id?: Id | null
  parent_page_id?: PageId | null
  status?: PageStatus
  title?: Name
}

export interface PageWithChildren extends Page {
  children: PageWithChildren[]
  depth: number
}

export interface PageTree extends Page {
  children?: PageTree[]
}
