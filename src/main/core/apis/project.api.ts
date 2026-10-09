import { projectService } from "@/main/core/services/project/project.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type { ApiResponse } from "@/shared/types";
import type { ProjectCreate, ProjectUpdate, ProjectQuery, ProjectDetail, ProjectReloadResult } from "@/main/types/db";
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

async function setProjectPinned(id: string, isPinned: boolean): Promise<ApiResponse<number>> {
  try {
    const changes = projectService.setProjectPinned(id, isPinned);
    if (changes > 0) {
      return response.success(changes);
    } else {
      return response.error(ErrorCode.PROJECT_NOT_FOUND);
    }
  } catch (error) {
    Logger.error("更新作品置顶状态失败", { error: JSON.stringify(error), id, isPinned });
    return response.error(ErrorCode.PROJECT_UPDATE_FAILED, error as Error);
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

/**
 * 按名称模糊检索作品（供日志条目 composer 的 & 下拉使用）
 * 空/纯空白名称返回空数组，不抛错
 */
async function searchProjectsByName(name: string): Promise<ApiResponse<Array<{ id: string; name: string }>>> {
  try {
    if (!name || !name.trim()) {
      return response.success<Array<{ id: string; name: string }>>([]);
    }
    const projects = projectService.searchByName(name.trim());
    return response.success(projects.map((p) => ({ id: p.id, name: p.name })));
  } catch (error) {
    Logger.error("按名称检索作品失败", { error: String(error), name });
    // 列表型 handler：返回的是候选数组，错误码与 :37 / :99 同族用 LIST_FAILED（而非单项 GET_FAILED）
    return response.error(ErrorCode.PROJECT_LIST_FAILED, error as Error);
  }
}

/**
 * 根据作品文件夹中的 project.json / pages.json 重置 projects 与 pages 表
 * @returns 重载的作品与页面数量
 */
async function resetProjectTable(): Promise<ApiResponse<ProjectReloadResult>> {
  try {
    const result = projectService.resetProjectTable();
    return response.success(result);
  } catch (error) {
    Logger.error("重置 projects/pages 表失败", { error: String(error) });
    return response.error(ErrorCode.PROJECT_RESET_FAILED, error as Error);
  }
}

export {
  getProject,
  paginateProjects,
  createProject,
  updateProject,
  deleteProject,
  setProjectPinned,
  checkProjectNameExists,
  searchProjectsByName,
  resetProjectTable,
}