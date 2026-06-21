import type { ApiResponse } from "@/shared/types";
import type {
  Page,
  PageCreate,
  PageUpdate,
  PageQuery,
  PageTree,
} from "@/main/types/db";
import type { PaginationResult } from "@/shared/utils/pagination";

export interface PageAPI {
  get(id: string): Promise<ApiResponse<Page | null>>;
  paginate(params: {
    page?: number;
    pageSize?: number;
    orderBy?: string;
    orderDir?: "ASC" | "DESC";
    conditions?: PageQuery;
  }): Promise<ApiResponse<PaginationResult<Page>>>;
  getTree(projectId: string): Promise<ApiResponse<PageTree[]>>;
  create(data: PageCreate): Promise<ApiResponse<string>>;
  update(id: string, data: PageUpdate): Promise<ApiResponse<number>>;
  delete(id: string): Promise<ApiResponse<number>>;
}
