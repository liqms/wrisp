import { PageDao } from "@/main/core/db";
import type {
  Page,
  PageCreate,
  PageUpdate,
  PageQuery,
  PageTree,
} from "@/main/types/db";
import { PaginationResult } from "@/shared/utils/pagination";
import { Logger } from "@/main/utils/logger";

/**
 * 页面服务
 * 提供页面的 CRUD 操作及业务逻辑封装
 */
class PageService {
  private static instance: PageService | null = null;
  private pageDao: PageDao;

  private constructor() {
    this.pageDao = new PageDao();
  }

  /**
   * 获取 PageService 单例实例
   */
  public static getInstance(): PageService {
    if (!PageService.instance) {
      PageService.instance = new PageService();
    }
    return PageService.instance;
  }

  /**
   * 根据 ID 获取页面详情
   */
  public getPage(id: string): Page | null {
    try {
      return this.pageDao.findById(id);
    } catch (error) {
      Logger.error("获取页面失败", { error: String(error), id });
      throw error;
    }
  }

  /**
   * 分页查询页面列表（支持组合条件）
   */
  public paginatePages(params: {
    page?: number;
    pageSize?: number;
    orderBy?: string;
    orderDir?: "ASC" | "DESC";
    conditions?: PageQuery;
  }): PaginationResult<Page> {
    try {
      return this.pageDao.paginate({
        ...params,
        conditions: params.conditions as Record<string, unknown> | undefined,
      });
    } catch (error) {
      Logger.error("分页查询页面失败", { error: String(error), params });
      throw error;
    }
  }

  /**
   * 获取项目页面树
   */
  public getPageTree(projectId: string): PageTree[] {
    try {
      return this.pageDao.getPageTree(projectId);
    } catch (error) {
      Logger.error("获取页面树失败", { error: String(error), projectId });
      throw error;
    }
  }

  /**
   * 创建页面
   */
  public createPage(data: PageCreate): string {
    try {
      const id = this.pageDao.create(data);
      Logger.info("创建页面成功", { id, title: data.title });
      return id;
    } catch (error) {
      Logger.error("创建页面失败", { error: String(error), data });
      throw error;
    }
  }

  /**
   * 更新页面
   */
  public updatePage(id: string, data: PageUpdate): number {
    try {
      const changes = this.pageDao.update(id, data);
      if (changes > 0) {
        Logger.info("更新页面成功", { id });
      }
      return changes;
    } catch (error) {
      Logger.error("更新页面失败", { error: String(error), id, data });
      throw error;
    }
  }

  /**
   * 删除页面
   */
  public deletePage(id: string): number {
    try {
      const changes = this.pageDao.delete(id);
      if (changes > 0) {
        Logger.info("删除页面成功", { id });
      }
      return changes;
    } catch (error) {
      Logger.error("删除页面失败", { error: String(error), id });
      throw error;
    }
  }
}

export default PageService;

export const pageService = PageService.getInstance();
