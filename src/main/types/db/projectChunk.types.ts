import { Timestamp, Ensure, NonEmptyString, QueryParams, Content } from '@/shared/types'
import { ProjectId, ChunkId } from './'

export interface ProjectChunk {
  project_id: ProjectId
  chunk_id: ChunkId
  relevance_score: number
  created_at: Timestamp
  updated_at: Timestamp
}

export interface ProjectChunkCreate {
  project_id: ProjectId
  chunk_id: ChunkId
  relevance_score?: number
  created_at?: Timestamp
  updated_at?: Timestamp
}

export interface ProjectChunkUpdate {
  relevance_score?: number
  updated_at?: Timestamp
}

export type StrictProjectChunkCreate = Ensure<ProjectChunkCreate, {
  project_id: NonEmptyString<ProjectId>
  chunk_id: NonEmptyString<ChunkId>
}>

export interface ProjectChunkQuery extends QueryParams {
  project_id?: ProjectId
  chunk_id?: ChunkId
  relevance_score_min?: number
  relevance_score_max?: number
}

export interface ProjectChunkWithDetails extends ProjectChunk {
  chunk_content: Content
  chunk_created_at: Timestamp
}