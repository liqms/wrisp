import { projectService } from "@/main/core/services/project.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type { ApiResponse } from "@/shared/types";
import type { Project, ProjectCreate, ProjectUpdate, ProjectQuery, ProjectDetail } from "@/main/types/db";
import type { PaginationResult } from "@/shared/utils/pagination";
import { Logger } from "@/main/utils/logger";

async function getProject(id: string): Promise<ApiResponse<ProjectDetail | null>> {
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


async function paginateProjects(params: {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: "ASC" | "DESC";
  conditions?: ProjectQuery;
}): Promise<ApiResponse<PaginationResult<ProjectDetail>>> {
  try {
    const result = projectService.paginateProjects(params);
    Logger.debug("分页查询作品成功", { params, result });
    return response.success(result);
  } catch (error) {
    Logger.error("分页查询作品失败", { error: JSON.stringify(error), params });
    return response.error(ErrorCode.PROJECT_LIST_FAILED, error as Error);
  }
}

async function createProject(data: ProjectCreate): Promise<ApiResponse<string>> {
  try {
    const id = projectService.createProject(data);
    return response.success(id);
  } catch (error) {
    Logger.error("创建作品失败", { error: JSON.stringify(error), data });
    return response.error(ErrorCode.PROJECT_CREATE_FAILED, error as Error);
  }
}

async function updateProject(id: string, data: ProjectUpdate): Promise<ApiResponse<number>> {
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

async function deleteProject(id: string): Promise<ApiResponse<number>> {
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

async function checkProjectNameExists(name: string, excludeId?: string): Promise<ApiResponse<boolean>> {
  try {
    const exists = projectService.checkProjectNameExists(name, excludeId);
    return response.success(exists);
  } catch (error) {
    Logger.error("检查作品名称是否存在失败", { error: JSON.stringify(error), name, excludeId });
    return response.error(ErrorCode.PROJECT_LIST_FAILED, error as Error);
  }
}

export {
  getProject,
  paginateProjects,
  createProject,
  updateProject,
  deleteProject,
  checkProjectNameExists,
}