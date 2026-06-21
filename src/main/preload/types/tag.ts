import type {
  Tag,
  TagCreate,
  TagUpdate,
  TagQuery,
  TagDetail,
  TagId,
  ApiResponse,
} from "@/shared/types";

export interface TagAPI {
  getDetailById(id: TagId): Promise<ApiResponse<TagDetail | null>>;
  findTags(
    name: string,
    options?: { exact?: boolean; limit?: number },
  ): Promise<ApiResponse<Tag[]>>;
  getAllTags(entityType?: string): Promise<ApiResponse<TagDetail[]>>;
  paginateTags(params: {
    page?: number;
    pageSize?: number;
    orderBy?: string;
    orderDir?: "ASC" | "DESC";
    conditions?: TagQuery;
  }): Promise<ApiResponse<any>>;
  createTags(
    data: TagCreate | TagCreate[],
  ): Promise<ApiResponse<string | string[]>>;
  updateTag(
    items:
      | { id: TagId; data: TagUpdate }
      | { id: TagId; data: TagUpdate }[],
  ): Promise<ApiResponse<number | number[]>>;
  deleteTag(ids: TagId | TagId[]): Promise<ApiResponse<number>>;
}