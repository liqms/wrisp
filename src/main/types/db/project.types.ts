import { Id, Timestamp, Ensure, NonEmptyString, Name, Content, QueryParams, Description, JsonMetadata } from '@/shared/types'

export type ProjectId = Id

export type ProjectType = 'novel' | 'series' | 'book' | 'blog_series' | 'research'


export interface Project {
  id: ProjectId
  name: Name
  description: Description
  type: ProjectType
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
  ai_summary?: Content | null
  structure?: JsonMetadata | null
  metadata?: JsonMetadata
  created_at?: Timestamp
  updated_at?: Timestamp
}

export interface ProjectUpdate {
  name?: Name
  description?: Description
  type?: ProjectType
  ai_summary?: Content | null
  structure?: JsonMetadata | null
  metadata?: JsonMetadata
  updated_at?: Timestamp
}

export type StrictProjectCreate = Ensure<ProjectCreate, {
  id: NonEmptyString<ProjectId>
  name: NonEmptyString<Name>
}>

export interface ProjectQuery extends QueryParams {
  name?: Name
  type?: ProjectType
}

export interface ProjectWithStats extends Project {
  block_count: number
  page_count: number
}
