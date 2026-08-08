import { Id, Timestamp, Ensure, NonEmptyString, QueryParams } from '@/shared/types'

export type TopicChunkId = Id

export interface TopicChunk {
  topic_id: Id
  chunk_id: Id
  relevance_score: number
  created_at: Timestamp
  updated_at: Timestamp
}

export interface TopicChunkCreate {
  topic_id: Id
  chunk_id: Id
  relevance_score?: number
  created_at?: Timestamp
  updated_at?: Timestamp
}

export interface TopicChunkUpdate {
  relevance_score?: number
  updated_at?: Timestamp
}

export type StrictTopicChunkCreate = Ensure<TopicChunkCreate, {
  topic_id: NonEmptyString<Id>
  chunk_id: NonEmptyString<Id>
}>

export interface TopicChunkQuery extends QueryParams {
  topic_id?: Id
  chunk_id?: Id
  relevance_score_min?: number
  relevance_score_max?: number
}