import { Id, Timestamp, Ensure, NonEmptyString, QueryParams } from '@/shared/types'

export type TopicBlockId = Id

export interface TopicBlock {
  topic_id: Id
  block_id: Id
  relevance_score: number
  created_at: Timestamp
  updated_at: Timestamp
}

export interface TopicBlockCreate {
  topic_id: Id
  block_id: Id
  relevance_score?: number
  created_at?: Timestamp
  updated_at?: Timestamp
}

export interface TopicBlockUpdate {
  relevance_score?: number
  updated_at?: Timestamp
}

export type StrictTopicBlockCreate = Ensure<TopicBlockCreate, {
  topic_id: NonEmptyString<Id>
  block_id: NonEmptyString<Id>
}>

export interface TopicBlockQuery extends QueryParams {
  topic_id?: Id
  block_id?: Id
  relevance_score_min?: number
  relevance_score_max?: number
}
