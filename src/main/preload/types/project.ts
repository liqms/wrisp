import type { ApiResponse } from "@/shared/types";
import type {
  Project,
  ProjectCreate,
  ProjectUpdate,
  ProjectQuery,
  ProjectWithStats,
} from "@/main/types/db";
import type { PaginationResult } from "@/shared/utils/pagination";

export interface ProjectAPI {
  get(id: string): Promise<ApiResponse<Project | null>>;

  paginate(params: {
    page?: number;
    pageSize?: number;
    orderBy?: string;
    orderDir?: "ASC" | "DESC";
    conditions?: ProjectQuery;
  }): Promise<ApiResponse<PaginationResult<Project>>>;
  getWithStats(id: string): Promise<ApiResponse<ProjectWithStats | null>>;
  getAllWithStats(): Promise<ApiResponse<ProjectWithStats[]>>;
  findByName(name: string): Promise<ApiResponse<Project | null>>;
  findByType(type: string): Promise<ApiResponse<Project[]>>;
  create(data: ProjectCreate): Promise<ApiResponse<string>>;
  update(id: string, data: ProjectUpdate): Promise<ApiResponse<number>>;
  delete(id: string): Promise<ApiResponse<number>>;
  checkNameExists(
    name: string,
    excludeId?: string,
  ): Promise<ApiResponse<boolean>>;
}
