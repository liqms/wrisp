import { Id, Timestamp, Ensure, NonEmptyString, Name, Content, QueryParams, JsonMetadata } from '@/shared/types'

export type ConceptId = Id

export interface Concept {
  id: ConceptId
  title: Name
  evolving_summary: Content | null
  timeline: JsonMetadata
  relevance: number
  created_at: Timestamp
  updated_at: Timestamp
}

export interface ConceptCreate {
  id?: ConceptId
  title: Name
  evolving_summary?: Content | null
  timeline?: JsonMetadata
  relevance?: number
  created_at?: Timestamp
  updated_at?: Timestamp
}

export interface ConceptUpdate {
  title?: Name
  evolving_summary?: Content | null
  timeline?: JsonMetadata
  relevance?: number
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
