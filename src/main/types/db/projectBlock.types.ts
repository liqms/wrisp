import { Timestamp, Ensure, NonEmptyString, QueryParams, Content } from '@/shared/types'
import { ProjectId, BlockId } from './'

export interface ProjectBlock {
  project_id: ProjectId
  block_id: BlockId
  relevance_score: number
  created_at: Timestamp
  updated_at: Timestamp
}

export interface ProjectBlockCreate {
  project_id: ProjectId
  block_id: BlockId
  relevance_score?: number
  created_at?: Timestamp
  updated_at?: Timestamp
}

export interface ProjectBlockUpdate {
  relevance_score?: number
  updated_at?: Timestamp
}

export type StrictProjectBlockCreate = Ensure<ProjectBlockCreate, {
  project_id: NonEmptyString<ProjectId>
  block_id: NonEmptyString<BlockId>
}>

export interface ProjectBlockQuery extends QueryParams {
  project_id?: ProjectId
  block_id?: BlockId
  relevance_score_min?: number
  relevance_score_max?: number
}

export interface ProjectBlockWithDetails extends ProjectBlock {
  block_content: Content
  block_created_at: Timestamp
}
