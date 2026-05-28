import { Id, Timestamp, Ensure, NonEmptyString, QueryParams } from '@/shared/types'

export type TopicConceptId = Id

export interface TopicConcept {
  topic_id: Id
  concept_id: Id
  relevance_score: number
  created_at: Timestamp
  updated_at: Timestamp
}

export interface TopicConceptCreate {
  topic_id: Id
  concept_id: Id
  relevance_score?: number
  created_at?: Timestamp
  updated_at?: Timestamp
}

export interface TopicConceptUpdate {
  relevance_score?: number
  updated_at?: Timestamp
}

export type StrictTopicConceptCreate = Ensure<TopicConceptCreate, {
  topic_id: NonEmptyString<Id>
  concept_id: NonEmptyString<Id>
}>

export interface TopicConceptQuery extends QueryParams {
  topic_id?: Id
  concept_id?: Id
  relevance_score_min?: number
  relevance_score_max?: number
}
