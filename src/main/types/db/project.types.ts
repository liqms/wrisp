import { Id, Timestamp, Ensure, NonEmptyString, Name, Content, QueryParams, Description, JsonMetadata } from '@/shared/types'
import type { Tag, TagId } from './tag.types'
import type { ProjectType } from '@/shared/enums'

export type ProjectId = Id

export type ProjectStatus = 'active' | 'deleted'

export interface Project {
  id: ProjectId
  name: Name
  description: Description
  type: ProjectType
  status: ProjectStatus
  created_at: Timestamp
  updated_at: Timestamp
  ai_summary: Content | null
  structure: JsonMetadata | null
  metadata: JsonMetadata
}

export interface ProjectCreate {
  id?: ProjectId
  name: Name
  description?: Description
  type?: ProjectType
  status?: ProjectStatus
  ai_summary?: Content | null
  structure?: JsonMetadata | null
  metadata?: JsonMetadata
  tags?: TagId[]
  created_at?: Timestamp
  updated_at?: Timestamp
}

export interface ProjectUpdate {
  name?: Name
  description?: Description
  type?: ProjectType
  status?: ProjectStatus
  ai_summary?: Content | null
  structure?: JsonMetadata | null
  metadata?: JsonMetadata
  tags?: TagId[]
  updated_at?: Timestamp
}

export type StrictProjectCreate = Ensure<ProjectCreate, {
  id: NonEmptyString<ProjectId>
  name: NonEmptyString<Name>
}>

export interface ProjectQuery extends QueryParams {
  name?: Name
  type?: ProjectType
  status?: ProjectStatus
  tags?: TagId[]
}

export interface ProjectDetail extends Project {
  block_count: number
  page_count: number
  tags?: Tag[]
}
