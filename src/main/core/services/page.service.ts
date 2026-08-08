import { PageDao } from "@/main/core/db";
import type {
  Page,
  PageCreate,
  PageUpdate,
  PageTree,
} from "@/main/types/db";
import type {
  CreatePageInput,
  UpdatePageInput,
  PageQuery,
} from "@/shared/types/page.types";
import { PaginationResult } from "@/shared/utils/pagination";
import { Logger } from "@/main/utils/logger";
import { fileService } from "@/main/core/services/base/file.service";
import { NodeCryptoUtil } from "@/main/utils";
import { TimeUtil } from "@/shared/utils";
import { PAGE_TYPE } from "@/shared/enums";
import { PROJECT_SETTINGS_DIR, CHAPTER_DIR } from "@/main/constants/folder.constants";

/**
 * 页面服务
 * 编排两层存储：
 *   1. md 文件（fileService）
 *   2. 页面表（PageDao, pages 表）
 *
 * 文件命名规则：projects/{projectId}/{settings|chapters}/{timestamp}.md
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
   * 生成页面文件路径
   * 格式：projects/{projectId}/{settings|chapters}/{timestamp}.md
   */
  private generateFilePath(
    projectId: string | null,
    pageType: PAGE_TYPE
  ): string {
    const timestamp = TimeUtil.getLocalDateString();
    const dir =
      pageType === PAGE_TYPE.PROJECT_SETTING
        ? PROJECT_SETTINGS_DIR
        : CHAPTER_DIR;
    if (projectId) {
      return `projects/${projectId}/${dir}/${timestamp}.md`;
    }
    return `pages/${timestamp}.md`;
  }

  /**
   * 根据 ID 获取页面详情
   * 从 pages 表读取元数据，从 md 文件读取内容
   */
  public getPage(id: string): Page | null {
    try {
      const page = this.pageDao.findById(id);
      if (!page) return null;

      let content: string | null = null;
      if (fileService.exists(page.file_path)) {
        content = fileService.readFile(page.file_path);
      }

      return { ...page, content };
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
      // 将 shared PageQuery（camelCase）转换为 db PageQuery（snake_case）
      const dbConditions = params.conditions
        ? {
          project_id: params.conditions.projectId,
          parent_page_id: params.conditions.parentId,
          status: params.conditions.status,
          title: params.conditions.title,
        }
        : undefined;

      return this.pageDao.paginate({
        ...params,
        conditions: dbConditions as Record<string, unknown> | undefined,
      });
    } catch (error) {
      Logger.error("分页查询页面失败", { error: String(error), params });
      throw error;
    }
  }

  /**
   * 获取项目页面树
   * 根据 projectId 和 pageType 过滤页面
   */
  public getPageTree(projectId: string, pageType: PAGE_TYPE): PageTree[] {
    try {
      const tree = this.pageDao.getPageTree(projectId);
      return this.filterTreeByPageType(tree, pageType);
    } catch (error) {
      Logger.error("获取页面树失败", { error: String(error), projectId, pageType });
      throw error;
    }
  }

  /**
   * 递归过滤页面树，只保留指定 pageType 的节点
   */
  private filterTreeByPageType(nodes: PageTree[], pageType: PAGE_TYPE): PageTree[] {
    return nodes
      .filter(node => node.page_type === pageType)
      .map(node => ({
        ...node,
        children: node.children
          ? this.filterTreeByPageType(node.children, pageType)
          : undefined,
      }));
  }

  /**
   * 创建页面
   * 1. 写入 md 文件
   * 2. 保存到页面表
   */
  public createPage(data: CreatePageInput): string {
    try {
      const pageId = NodeCryptoUtil.generateUUID();
      const pageType = data.pageType || PAGE_TYPE.PROJECT_CHAPTER;
      const filePath = this.generateFilePath(data.projectId, pageType);

      // 1. 写入 md 文件
      fileService.writeFile(filePath, data.content || "");

      // 2. 保存到页面表（转换为 db 类型）
      const pageCreate: PageCreate = {
        id: pageId,
        project_id: data.projectId,
        title: data.title,
        file_path: filePath,
        order_index: 0,
        parent_page_id: data.parentId,
        is_container: 0,
        word_count: 0,
        ai_summary: null,
        metadata: data.metadata,
        status: "active",
        page_type: pageType,
      };
      this.pageDao.create(pageCreate);

      Logger.info("创建页面成功", { id: pageId, title: data.title, filePath, pageType });
      return pageId;
    } catch (error) {
      Logger.error("创建页面失败", { error: String(error), data });
      throw error;
    }
  }

  /**
   * 更新页面
   * 1. 更新 md 文件
   * 2. 更新页面表
   */
  public updatePage(data: UpdatePageInput): number {
    try {
      const { id, ...updateData } = data;
      const existing = this.pageDao.findById(id);
      if (!existing) {
        Logger.warn("更新页面失败，页面不存在", { id });
        return 0;
      }

      // 1. 更新 md 文件
      if (updateData.content !== undefined) {
        fileService.writeFile(existing.file_path, updateData.content || "");
      }

      // 2. 更新页面表（转换为 db 类型）
      const pageUpdate: PageUpdate = {
        metadata: updateData.metadata,
        status: updateData.status,
      };
      const changes = this.pageDao.update(id, pageUpdate);

      if (changes > 0) {
        Logger.info("更新页面成功", { id });
      }
      return changes;
    } catch (error) {
      Logger.error("更新页面失败", { error: String(error), id: data.id, data });
      throw error;
    }
  }

  /**
   * 删除页面
   * 1. 删除 md 文件
   * 2. 删除页面表记录
   */
  public deletePage(id: string): number {
    try {
      const existing = this.pageDao.findById(id);
      if (!existing) {
        Logger.warn("删除页面失败，页面不存在", { id });
        return 0;
      }

      // 1. 删除 md 文件
      if (fileService.exists(existing.file_path)) {
        fileService.remove(existing.file_path);
      }

      // 2. 删除页面表记录
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