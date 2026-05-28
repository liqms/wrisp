import { Id, Timestamp, Ensure, NonEmptyString, QueryParams } from '@/shared/types'

export type ReflectionBlockId = Id

export interface ReflectionBlock {
  reflection_id: Id
  block_id: Id
  relevance_score: number
  created_at: Timestamp
  updated_at: Timestamp
}

export interface ReflectionBlockCreate {
  reflection_id: Id
  block_id: Id
  relevance_score?: number
  created_at?: Timestamp
  updated_at?: Timestamp
}

export interface ReflectionBlockUpdate {
  relevance_score?: number
  updated_at?: Timestamp
}

export type StrictReflectionBlockCreate = Ensure<ReflectionBlockCreate, {
  reflection_id: NonEmptyString<Id>
  block_id: NonEmptyString<Id>
}>

export interface ReflectionBlockQuery extends QueryParams {
  reflection_id?: Id
  block_id?: Id
  relevance_score_min?: number
  relevance_score_max?: number
}
