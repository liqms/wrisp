import { Id, Timestamp, Ensure, NonEmptyString, QueryParams } from '@/shared/types'

export type TaggedItemId = Id

export type EntityType = 'block' | 'project' | 'file'

export interface TaggedItem {
  id: TaggedItemId
  tag_id: Id
  entity_type: EntityType
  entity_id: Id
  added_at: Timestamp
}

export interface TaggedItemCreate {
  id?: TaggedItemId
  tag_id: Id
  entity_type: EntityType
  entity_id: Id
  added_at?: Timestamp
}

export interface TaggedItemUpdate {
  tag_id?: Id
  entity_type?: EntityType
  entity_id?: Id
}

export type StrictTaggedItemCreate = Ensure<TaggedItemCreate, {
  tag_id: NonEmptyString<Id>
  entity_type: EntityType
  entity_id: NonEmptyString<Id>
}>

export interface TaggedItemQuery extends QueryParams {
  tag_id?: Id
  entity_type?: EntityType
  entity_id?: Id
}

export interface TaggedBlock extends TaggedItem {
  block_id: Id
}

export interface TaggedProject extends TaggedItem {
  project_id: Id
}
