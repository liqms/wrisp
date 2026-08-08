import { Id, Timestamp, Ensure, NonEmptyString, QueryParams } from '@/shared/types'

export type ConceptChunkId = Id

export interface ConceptChunk {
  concept_id: Id
  chunk_id: Id
  relevance_score: number
  created_at: Timestamp
  updated_at: Timestamp
}

export interface ConceptChunkCreate {
  concept_id: Id
  chunk_id: Id
  relevance_score?: number
  created_at?: Timestamp
  updated_at?: Timestamp
}

export interface ConceptChunkUpdate {
  relevance_score?: number
  updated_at?: Timestamp
}

export type StrictConceptChunkCreate = Ensure<ConceptChunkCreate, {
  concept_id: NonEmptyString<Id>
  chunk_id: NonEmptyString<Id>
}>

export interface ConceptChunkQuery extends QueryParams {
  concept_id?: Id
  chunk_id?: Id
  relevance_score_min?: number
  relevance_score_max?: number
}