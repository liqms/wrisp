import { Id, Timestamp, Ensure, NonEmptyString, Name, Content, QueryParams } from '@/shared/types'

export type ReflectionId = Id

export type ReflectionType = 'pattern' | 'contradiction' | 'evolution' | 'insight'

export type ReflectionStatus = 'pending' | 'read' | 'archived'

export interface Reflection {
  id: ReflectionId
  type: ReflectionType
  title: Name
  content: Content
  ai_explanation: Content | null
  status: ReflectionStatus
  created_at: Timestamp
  updated_at: Timestamp
}

export interface ReflectionCreate {
  id?: ReflectionId
  type: ReflectionType
  title: Name
  content: Content
  ai_explanation?: Content | null
  status?: ReflectionStatus
  created_at?: Timestamp
  updated_at?: Timestamp
}

export interface ReflectionUpdate {
  type?: ReflectionType
  title?: Name
  content?: Content
  ai_explanation?: Content | null
  status?: ReflectionStatus
  updated_at?: Timestamp
}

export type StrictReflectionCreate = Ensure<ReflectionCreate, {
  id: NonEmptyString<ReflectionId>
  type: ReflectionType
  title: NonEmptyString<Name>
  content: NonEmptyString<Content>
}>

export interface ReflectionQuery extends QueryParams {
  type?: ReflectionType
  status?: ReflectionStatus
  title?: Name
}

export interface ReflectionWithBlocks extends Reflection {
  block_count: number
  blocks_preview: Content[]
}
