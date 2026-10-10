import { Id, Timestamp, Ensure, NonEmptyString, Name, Content, QueryParams, JsonMetadata } from '@/shared/types'

export type ConceptId = Id

export interface Concept {
  id: ConceptId
  title: Name
  evolving_summary: Content | null
  timeline: JsonMetadata
  relevance: number
  /** 归一化标题键（幂等合并依据），历史数据迁移前为 null */
  title_key: Name | null
  /** 别名 JSON 数组原文（如 ["RAG","检索增强"]） */
  aliases: string
  /** 累计被抽取命中的次数，驱动时间线证据权重 */
  mention_count: number
  /** 最近一次重算演化摘要的时间，用于增量触发（未演化时为 null） */
  last_evolved_at: Timestamp | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface ConceptCreate {
  id?: ConceptId
  title: Name
  evolving_summary?: Content | null
  timeline?: JsonMetadata
  relevance?: number
  title_key?: Name | null
  aliases?: string
  mention_count?: number
  last_evolved_at?: Timestamp | null
  created_at?: Timestamp
  updated_at?: Timestamp
}

export interface ConceptUpdate {
  title?: Name
  evolving_summary?: Content | null
  timeline?: JsonMetadata
  relevance?: number
  title_key?: Name | null
  aliases?: string
  mention_count?: number
  last_evolved_at?: Timestamp | null
  updated_at?: Timestamp
}

export type StrictConceptCreate = Ensure<ConceptCreate, {
  id: NonEmptyString<ConceptId>
  title: NonEmptyString<Name>
}>

export interface ConceptQuery extends QueryParams {
  title?: Name
  relevance_min?: number
  relevance_max?: number
}

export interface ConceptWithBlocks extends Concept {
  block_count: number
  linked_block_contents: Content[]
  blocks: { id: string; content: string; relevance_score: number }[]
}
