import { Id, Timestamp, Ensure, NonEmptyString, Content, QueryParams } from '@/shared/types'

export type SemanticLinkId = Id

export type LinkType = 'semantic' | 'reference' | 'contradiction'

export interface SemanticLink {
  id: SemanticLinkId
  source_chunk_id: Id
  target_chunk_id: Id
  link_type: LinkType
  similarity: number
  ai_explanation: Content | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface SemanticLinkCreate {
  id?: SemanticLinkId
  source_chunk_id: Id
  target_chunk_id: Id
  link_type?: LinkType
  similarity?: number
  ai_explanation?: Content | null
  created_at?: Timestamp
  updated_at?: Timestamp
}

export interface SemanticLinkUpdate {
  link_type?: LinkType
  similarity?: number
  ai_explanation?: Content | null
  updated_at?: Timestamp
}

export type StrictSemanticLinkCreate = Ensure<SemanticLinkCreate, {
  id: NonEmptyString<SemanticLinkId>
  source_chunk_id: NonEmptyString<Id>
  target_chunk_id: NonEmptyString<Id>
}>

export interface SemanticLinkQuery extends QueryParams {
  source_chunk_id?: Id
  target_chunk_id?: Id
  link_type?: LinkType
  similarity_min?: number
  similarity_max?: number
}

export interface SemanticLinkWithBlocks extends SemanticLink {
  source_content: Content
  target_content: Content
}
