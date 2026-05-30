import { projectService } from "@/main/core/services/project.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type { ApiResponse } from "@/shared/types";
import type { Project, ProjectCreate, ProjectUpdate, ProjectQuery, ProjectWithStats } from "@/main/types/db";
import type { PaginationResult } from "@/shared/utils/pagination";
import { Logger } from "@/main/utils/logger";

export async function getProject(id: string): Promise<ApiResponse<Project | null>> {
  try {
    const project = projectService.getProject(id);
    if (project) {
      return response.success(project);
    } else {
      return response.error(ErrorCode.PROJECT_NOT_FOUND);
    }
  } catch (error) {
    Logger.error("获取作品失败", { error: JSON.stringify(error), id });
    return response.error(ErrorCode.PROJECT_GET_FAILED, error as Error);
  }
}


export async function paginateProjects(params: {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: "ASC" | "DESC";
  conditions?: ProjectQuery;
}): Promise<ApiResponse<PaginationResult<Project>>> {
  try {
    const result = projectService.paginateProjects(params);
    return response.success(result);
  } catch (error) {
    Logger.error("分页查询作品失败", { error: JSON.stringify(error), params });
    return response.error(ErrorCode.PROJECT_LIST_FAILED, error as Error);
  }
}

export async function getProjectWithStats(id: string): Promise<ApiResponse<ProjectWithStats | null>> {
  try {
    const project = projectService.getProjectWithStats(id);
    if (project) {
      return response.success(project);
    } else {
      return response.error(ErrorCode.PROJECT_NOT_FOUND);
    }
  } catch (error) {
    Logger.error("获取作品统计信息失败", { error: JSON.stringify(error), id });
    return response.error(ErrorCode.PROJECT_GET_FAILED, error as Error);
  }
}

export async function getAllProjectsWithStats(): Promise<ApiResponse<ProjectWithStats[]>> {
  try {
    const projects = projectService.getAllProjectsWithStats();
    return response.success(projects);
  } catch (error) {
    Logger.error("获取作品统计列表失败", { error: JSON.stringify(error) });
    return response.error(ErrorCode.PROJECT_LIST_FAILED, error as Error);
  }
}

export async function findProjectByName(name: string): Promise<ApiResponse<Project | null>> {
  try {
    const project = projectService.findProjectByName(name);
    return response.success(project);
  } catch (error) {
    Logger.error("根据名称查询作品失败", { error: JSON.stringify(error), name });
    return response.error(ErrorCode.PROJECT_LIST_FAILED, error as Error);
  }
}

export async function findProjectsByType(type: string): Promise<ApiResponse<Project[]>> {
  try {
    const projects = projectService.findProjectsByType(type);
    return response.success(projects);
  } catch (error) {
    Logger.error("根据类型查询作品失败", { error: JSON.stringify(error), type });
    return response.error(ErrorCode.PROJECT_LIST_FAILED, error as Error);
  }
}

export async function createProject(data: ProjectCreate): Promise<ApiResponse<string>> {
  try {
    const id = projectService.createProject(data);
    return response.success(id);
  } catch (error) {
    Logger.error("创建作品失败", { error: JSON.stringify(error), data });
    return response.error(ErrorCode.PROJECT_CREATE_FAILED, error as Error);
  }
}

export async function updateProject(id: string, data: ProjectUpdate): Promise<ApiResponse<number>> {
  try {
    const changes = projectService.updateProject(id, data);
    if (changes > 0) {
      return response.success(changes);
    } else {
      return response.error(ErrorCode.PROJECT_NOT_FOUND);
    }
  } catch (error) {
    Logger.error("更新作品失败", { error: JSON.stringify(error), id, data });
    return response.error(ErrorCode.PROJECT_UPDATE_FAILED, error as Error);
  }
}

export async function deleteProject(id: string): Promise<ApiResponse<number>> {
  try {
    const changes = projectService.deleteProject(id);
    if (changes > 0) {
      return response.success(changes);
    } else {
      return response.error(ErrorCode.PROJECT_NOT_FOUND);
    }
  } catch (error) {
    Logger.error("删除作品失败", { error: JSON.stringify(error), id });
    return response.error(ErrorCode.PROJECT_DELETE_FAILED, error as Error);
  }
}

export async function checkProjectNameExists(name: string, excludeId?: string): Promise<ApiResponse<boolean>> {
  try {
    const exists = projectService.checkProjectNameExists(name, excludeId);
    return response.success(exists);
  } catch (error) {
    Logger.error("检查作品名称是否存在失败", { error: JSON.stringify(error), name, excludeId });
    return response.error(ErrorCode.PROJECT_LIST_FAILED, error as Error);
  }
}