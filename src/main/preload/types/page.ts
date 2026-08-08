import type { ApiResponse } from "@/shared/types";
import type { Page, PageTree } from "@/main/types/db";
import type { CreatePageInput, UpdatePageInput, PageQuery } from "@/shared/types/page.types";
import type { PaginationResult } from "@/shared/utils/pagination";
import type { PageType } from "@/shared/enums";

export interface PageAPI {
  get(id: string): Promise<ApiResponse<Page | null>>;
  paginate(params: {
    page?: number;
    pageSize?: number;
    orderBy?: string;
    orderDir?: "ASC" | "DESC";
    conditions?: PageQuery;
  }): Promise<ApiResponse<PaginationResult<Page>>>;
  getTree(projectId: string, pageType: PageType): Promise<ApiResponse<PageTree[]>>;
  create(data: CreatePageInput): Promise<ApiResponse<string>>;
  update(data: UpdatePageInput): Promise<ApiResponse<number>>;
  delete(id: string): Promise<ApiResponse<number>>;
}
