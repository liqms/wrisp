import type { ApiResponse } from "@/shared/types";
import type {
  ProjectCreate,
  ProjectUpdate,
  ProjectQuery,
  ProjectDetail,
} from "@/main/types/db";
import type { PaginationResult } from "@/shared/utils/pagination";

export interface ProjectAPI {
  get(id: string): Promise<ApiResponse<ProjectDetail | null>>;
  paginate(params: {
    page?: number;
    pageSize?: number;
    orderBy?: string;
    orderDir?: "ASC" | "DESC";
    conditions?: ProjectQuery;
  }): Promise<ApiResponse<PaginationResult<ProjectDetail>>>;
  create(data: ProjectCreate): Promise<ApiResponse<string>>;
  update(id: string, data: ProjectUpdate): Promise<ApiResponse<number>>;
  delete(id: string): Promise<ApiResponse<number>>;
  checkNameExists(name: string, excludeId?: string): Promise<ApiResponse<boolean>>;
}
