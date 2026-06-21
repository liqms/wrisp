import { ipcMain } from "electron";
import {
  getProject,
  paginateProjects,
  createProject,
  updateProject,
  deleteProject,
  checkProjectNameExists,
} from "@/main/core/apis/project.api";
import type { ApiResponse } from "@/shared/types";
import type {
  ProjectCreate,
  ProjectUpdate,
  ProjectQuery,
  ProjectDetail,
} from "@/main/types/db";
import type { PaginationResult } from "@/shared/utils/pagination";

export function registerProjectHandlers() {
  ipcMain.handle(
    "project:get",
    async (_, id: string): Promise<ApiResponse<ProjectDetail | null>> => {
      return getProject(id);
    },
  );

  ipcMain.handle(
    "project:paginate",
    async (
      _,
      params: {
        page?: number;
        pageSize?: number;
        orderBy?: string;
        orderDir?: "ASC" | "DESC";
        conditions?: ProjectQuery;
      },
    ): Promise<ApiResponse<PaginationResult<ProjectDetail>>> => {
      return paginateProjects(params);
    },
  );

  ipcMain.handle(
    "project:create",
    async (_, data: ProjectCreate): Promise<ApiResponse<string>> => {
      return createProject(data);
    },
  );

  ipcMain.handle(
    "project:update",
    async (
      _,
      id: string,
      data: ProjectUpdate,
    ): Promise<ApiResponse<number>> => {
      return updateProject(id, data);
    },
  );

  ipcMain.handle(
    "project:delete",
    async (_, id: string): Promise<ApiResponse<number>> => {
      return deleteProject(id);
    },
  );

  ipcMain.handle(
    "project:checkNameExists",
    async (
      _,
      name: string,
      excludeId?: string,
    ): Promise<ApiResponse<boolean>> => {
      return checkProjectNameExists(name, excludeId);
    },
  );
}
