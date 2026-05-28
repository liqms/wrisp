import { Id, Timestamp, Ensure, NonEmptyString, QueryParams } from '@/shared/types'

export type ConceptBlockId = Id

export interface ConceptBlock {
  concept_id: Id
  block_id: Id
  relevance_score: number
  created_at: Timestamp
  updated_at: Timestamp
}

export interface ConceptBlockCreate {
  concept_id: Id
  block_id: Id
  relevance_score?: number
  created_at?: Timestamp
  updated_at?: Timestamp
}

export interface ConceptBlockUpdate {
  relevance_score?: number
  updated_at?: Timestamp
}

export type StrictConceptBlockCreate = Ensure<ConceptBlockCreate, {
  concept_id: NonEmptyString<Id>
  block_id: NonEmptyString<Id>
}>

export interface ConceptBlockQuery extends QueryParams {
  concept_id?: Id
  block_id?: Id
  relevance_score_min?: number
  relevance_score_max?: number
}
