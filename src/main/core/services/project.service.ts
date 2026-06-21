import { ProjectDao } from "@/main/core/db";
import type {
  ProjectCreate,
  ProjectUpdate,
  ProjectQuery,
  ProjectDetail,
} from "@/main/types/db";
import { PaginationResult } from "@/shared/utils/pagination";
import { Logger } from "@/main/utils/logger";

/**
 * 作品服务
 * 提供作品的 CRUD 操作及业务逻辑封装
 */
class ProjectService {
  private static instance: ProjectService | null = null;
  private projectDao: ProjectDao;

  private constructor() {
    this.projectDao = new ProjectDao();
  }

  /**
   * 获取 ProjectService 单例实例
   */
  public static getInstance(): ProjectService {
    if (!ProjectService.instance) {
      ProjectService.instance = new ProjectService();
    }
    return ProjectService.instance;
  }

  /**
   * 获取作品详情（含统计和标签）
   * @param id 作品 ID
   * @returns 作品详情对象，不存在时返回 null
   */
  public getProject(id: string): ProjectDetail | null {
    try {
      return this.projectDao.findDetail(id);
    } catch (error) {
      Logger.error("获取作品详情失败", { error: String(error), id });
      throw error;
    }
  }

  /**
   * 分页查询作品列表
   * @param params.page 页码（从 1 开始），默认 1
   * @param params.pageSize 每页记录数，默认 50
   * @param params.orderBy 排序字段，默认 'created_at'
   * @param params.orderDir 排序方向，默认 'ASC'
   * @param params.conditions 查询条件
   * @returns 分页结果
   */
  public paginateProjects(params: {
    page?: number;
    pageSize?: number;
    orderBy?: string;
    orderDir?: "ASC" | "DESC";
    conditions?: ProjectQuery;
  }): PaginationResult<ProjectDetail> {
    try {
      // 默认排除已删除的作品
      const conditions = (params.conditions || {}) as Record<string, unknown>;
      if (!conditions.status) {
        conditions.status = 'active';
      }
      return this.projectDao.paginateDetail({
        ...params,
        conditions,
      });
    } catch (error) {
      Logger.error("分页查询作品失败", { error: String(error), params });
      throw error;
    }
  }

  /**
   * 创建作品
   * @param data 作品创建参数
   * @returns 新创建的作品 ID
   */
  public createProject(data: ProjectCreate): string {
    try {
      const { tags, ...projectData } = data;
      const id = this.projectDao.create(projectData);
      if (tags && tags.length > 0) {
        this.projectDao.saveTags(id, tags);
      }
      Logger.info("创建作品成功", { id, name: data.name });
      return id;
    } catch (error) {
      Logger.error("创建作品失败", { error: String(error), data });
      throw error;
    }
  }

  /**
   * 更新作品
   * @param id 作品 ID
   * @param data 作品更新参数
   * @returns 受影响的行数
   */
  public updateProject(id: string, data: ProjectUpdate): number {
    try {
      const { tags, ...projectData } = data;
      const changes = this.projectDao.update(id, projectData);
      if (changes > 0) {
        if (tags !== undefined) {
          this.projectDao.saveTags(id, tags);
        }
        Logger.info("更新作品成功", { id });
      }
      return changes;
    } catch (error) {
      Logger.error("更新作品失败", { error: String(error), id, data });
      throw error;
    }
  }

  /**
   * 删除作品
   * @param id 作品 ID
   * @returns 受影响的行数
   */
  public deleteProject(id: string): number {
    try {
      Logger.info("[ProjectService] 软删除作品", { id });
      return this.projectDao.update(id, { status: 'deleted' } as ProjectUpdate);
    } catch (error) {
      Logger.error("[ProjectService] 软删除作品失败", { id, error: String(error) });
      throw error;
    }
  }

  /**
   * 检查作品名称是否已存在
   * @param name 作品名称
   * @param excludeId 需要排除的作品 ID（更新时使用）
   * @returns 名称已存在返回 true，否则返回 false
   */
  public checkProjectNameExists(name: string, excludeId?: string): boolean {
    try {
      return this.projectDao.checkNameExists(name, excludeId);
    } catch (error) {
      Logger.error("检查作品名称是否存在失败", {
        error: String(error),
        name,
        excludeId,
      });
      throw error;
    }
  }
}

export default ProjectService;

export const projectService = ProjectService.getInstance();