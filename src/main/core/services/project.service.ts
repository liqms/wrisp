import { ProjectDao } from "@/main/core/db";
import type {
  Project,
  ProjectCreate,
  ProjectUpdate,
  ProjectQuery,
  ProjectWithStats,
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
   * 根据 ID 获取作品
   * @param id 作品 ID
   * @returns 作品对象，不存在时返回 null
   */
  public getProject(id: string): Project | null {
    try {
      return this.projectDao.findById(id);
    } catch (error) {
      Logger.error("获取作品失败", { error: String(error), id });
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
  }): PaginationResult<Project> {
    try {
      return this.projectDao.paginate({
        ...params,
        conditions: params.conditions as Record<string, unknown> | undefined,
      });
    } catch (error) {
      Logger.error("分页查询作品失败", { error: String(error), params });
      throw error;
    }
  }

  /**
   * 获取作品及其关联统计信息
   * @param id 作品 ID
   * @returns 包含统计信息的作品对象，不存在时返回 null
   */
  public getProjectWithStats(id: string): ProjectWithStats | null {
    try {
      return this.projectDao.findWithStats(id);
    } catch (error) {
      Logger.error("获取作品统计信息失败", { error: String(error), id });
      throw error;
    }
  }

  /**
   * 获取所有作品及其关联统计信息
   * @returns 包含统计信息的作品列表
   */
  public getAllProjectsWithStats(): ProjectWithStats[] {
    try {
      return this.projectDao.findWithStats();
    } catch (error) {
      Logger.error("获取作品统计列表失败", { error: String(error) });
      throw error;
    }
  }

  /**
   * 根据名称查询作品
   * @param name 作品名称
   * @returns 作品对象，不存在时返回 null
   */
  public findProjectByName(name: string): Project | null {
    try {
      const results = this.projectDao.findBy("name", name);
      return results[0] ?? null;
    } catch (error) {
      Logger.error("根据名称查询作品失败", { error: String(error), name });
      throw error;
    }
  }

  /**
   * 根据类型查询作品列表
   * @param type 作品类型
   * @returns 作品列表
   */
  public findProjectsByType(type: string): Project[] {
    try {
      return this.projectDao.findBy("type", type);
    } catch (error) {
      Logger.error("根据类型查询作品失败", { error: String(error), type });
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
      const id = this.projectDao.create(data);
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
      const changes = this.projectDao.update(id, data);
      if (changes > 0) {
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
      const changes = this.projectDao.delete(id);
      if (changes > 0) {
        Logger.info("删除作品成功", { id });
      }
      return changes;
    } catch (error) {
      Logger.error("删除作品失败", { error: String(error), id });
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
