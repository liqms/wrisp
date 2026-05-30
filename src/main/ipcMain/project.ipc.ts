import { ipcMain } from "electron";
import {
  getProject,
  paginateProjects,
  getProjectWithStats,
  getAllProjectsWithStats,
  findProjectByName,
  findProjectsByType,
  createProject,
  updateProject,
  deleteProject,
  checkProjectNameExists,
} from "@/main/core/apis/project.api";
import type { ApiResponse } from "@/shared/types";
import type {
  Project,
  ProjectCreate,
  ProjectUpdate,
  ProjectQuery,
  ProjectWithStats,
} from "@/main/types/db";
import type { PaginationResult } from "@/shared/utils/pagination";

export function registerProjectHandlers() {
  ipcMain.handle(
    "project:get",
    async (_, id: string): Promise<ApiResponse<Project | null>> => {
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
    ): Promise<ApiResponse<PaginationResult<Project>>> => {
      return paginateProjects(params);
    },
  );

  ipcMain.handle(
    "project:getWithStats",
    async (_, id: string): Promise<ApiResponse<ProjectWithStats | null>> => {
      return getProjectWithStats(id);
    },
  );

  ipcMain.handle(
    "project:getAllWithStats",
    async (): Promise<ApiResponse<ProjectWithStats[]>> => {
      return getAllProjectsWithStats();
    },
  );

  ipcMain.handle(
    "project:findByName",
    async (_, name: string): Promise<ApiResponse<Project | null>> => {
      return findProjectByName(name);
    },
  );

  ipcMain.handle(
    "project:findByType",
    async (_, type: string): Promise<ApiResponse<Project[]>> => {
      return findProjectsByType(type);
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
