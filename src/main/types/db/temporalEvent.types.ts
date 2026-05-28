import { Id, Timestamp, Ensure, NonEmptyString, QueryParams, Content, JsonMetadata } from '@/shared/types'

export type TemporalEventId = Id

export type EventType = 'belief_change' | 'interest_spike' | 'topic_emergence'

export interface TemporalEvent {
  id: TemporalEventId
  block_id: Id
  event_type: EventType
  event_data: JsonMetadata | null
  temporal_score: number
  created_at: Timestamp
  updated_at: Timestamp
}

export interface TemporalEventCreate {
  id?: TemporalEventId
  block_id: Id
  event_type: EventType
  event_data?: JsonMetadata | null
  temporal_score?: number
  created_at?: Timestamp
  updated_at?: Timestamp
}

export interface TemporalEventUpdate {
  event_type?: EventType
  event_data?: JsonMetadata | null
  temporal_score?: number
  updated_at?: Timestamp
}

export type StrictTemporalEventCreate = Ensure<TemporalEventCreate, {
  id: NonEmptyString<TemporalEventId>
  block_id: NonEmptyString<Id>
  event_type: EventType
}>

export interface TemporalEventQuery extends QueryParams {
  block_id?: Id
  event_type?: EventType
  temporal_score_min?: number
  temporal_score_max?: number
}

export interface TemporalEventWithBlock extends TemporalEvent {
  block_content: Content
}
