import { Id, Timestamp, Ensure, NonEmptyString, Name, Description, QueryParams } from '@/shared/types'

export type TagId = Id

export interface Tag {
  id: TagId
  name: Name
  description: Description
  created_at: Timestamp
  updated_at: Timestamp
}

export interface TagCreate {
  id?: TagId
  name: Name
  description?: Description
  created_at?: Timestamp
  updated_at?: Timestamp
}

export interface TagUpdate {
  name?: Name
  description?: Description
  updated_at?: Timestamp
}

export type StrictTagCreate = Ensure<TagCreate, {
  id: NonEmptyString<TagId>
  name: NonEmptyString<Name>
}>

export interface TagQuery extends QueryParams {
  name?: Name
}

export interface TagDetail extends Tag {
  usage_count: number
}
