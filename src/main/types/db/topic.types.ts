import { Id, Timestamp, Ensure, NonEmptyString, Name, Content, QueryParams } from '@/shared/types'

export type TopicId = Id

export type TopicStatus = 'pending' | 'confirmed' | 'archived'

export interface Topic {
  id: TopicId
  title: Name
  summary: Content | null
  status: TopicStatus
  created_at: Timestamp
  updated_at: Timestamp
}

export interface TopicCreate {
  id?: TopicId
  title: Name
  summary?: Content | null
  status?: TopicStatus
  created_at?: Timestamp
  updated_at?: Timestamp
}

export interface TopicUpdate {
  title?: Name
  summary?: Content | null
  status?: TopicStatus
  updated_at?: Timestamp
}

export type StrictTopicCreate = Ensure<TopicCreate, {
  id: NonEmptyString<TopicId>
  title: NonEmptyString<Name>
}>

export interface TopicQuery extends QueryParams {
  status?: TopicStatus
  title?: Name
}

export interface TopicWithDetails extends Topic {
  block_count: number
  concept_count: number
  blocks_preview: Content[]
}
