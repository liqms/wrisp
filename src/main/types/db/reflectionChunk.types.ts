import { Id, Timestamp, Ensure, NonEmptyString, QueryParams } from '@/shared/types'

export type ReflectionChunkId = Id

export interface ReflectionChunk {
  reflection_id: Id
  chunk_id: Id
  relevance_score: number
  created_at: Timestamp
  updated_at: Timestamp
}

export interface ReflectionChunkCreate {
  reflection_id: Id
  chunk_id: Id
  relevance_score?: number
  created_at?: Timestamp
  updated_at?: Timestamp
}

export interface ReflectionChunkUpdate {
  relevance_score?: number
  updated_at?: Timestamp
}

export type StrictReflectionChunkCreate = Ensure<ReflectionChunkCreate, {
  reflection_id: NonEmptyString<Id>
  chunk_id: NonEmptyString<Id>
}>

export interface ReflectionChunkQuery extends QueryParams {
  reflection_id?: Id
  chunk_id?: Id
  relevance_score_min?: number
  relevance_score_max?: number
}