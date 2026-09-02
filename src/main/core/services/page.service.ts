import { PageDao, ProjectDao } from "@/main/core/db";
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
  MovePageInput,
} from "@/shared/types/page.types";
import { PaginationResult } from "@/shared/utils/pagination";
import { Logger } from "@/main/utils/logger";
import { fileService } from "@/main/core/services/base/file.service";
import { NodeCryptoUtil } from "@/main/utils";
import { PAGE_TYPE } from "@/shared/enums";
import { PROJECT_SETTINGS_DIR, CHAPTER_DIR } from "@/main/constants/folder.constants";

/**
 * 页面服务
 * 编排两层存储：
 *   1. md 文件（fileService）
 *   2. 页面表（PageDao, pages 表）
 * 创建/更新/移动/删除时同步页面元数据到作品文件夹中的 pages.json 文件
 *
 * 文件命名规则：projects/{projectDir}/{settings|chapters}/{timestamp}.md
 * projectDir 取作品的真实文件夹（project.file_path），而非作品 UUID。
 */
class PageService {
  private static instance: PageService | null = null;
  private pageDao: PageDao;
  private projectDao: ProjectDao;

  private constructor() {
    this.pageDao = new PageDao();
    this.projectDao = new ProjectDao();
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
   * 格式：projects/{projectDir}/{settings|chapters}/{timestamp}.md
   * projectDir 取作品的真实文件夹（project.file_path，形如 projects/{timestamp}/），
   * 避免使用作品 UUID 作为文件夹名，导致章节落到错误的目录。
   * 文件名使用 Unix 时间戳（与作品文件夹命名规则一致），日志文件仍保持日期格式。
   */
  private generateFilePath(
    projectId: string | null,
    pageType: PAGE_TYPE
  ): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const dir =
      pageType === PAGE_TYPE.PROJECT_SETTING
        ? PROJECT_SETTINGS_DIR
        : CHAPTER_DIR;
    if (projectId) {
      const project = this.projectDao.findById(projectId);
      const projectDir = project?.file_path || `projects/${projectId}/`;
      return `${projectDir}${dir}/${timestamp}.md`;
    }
    return `pages/${timestamp}.md`;
  }

  /**
   * 获取作品页面元数据 JSON 文件路径
   * @param projectDir - 作品文件夹路径
   * @returns pages.json 的完整路径
   */
  private getPagesJsonFilePath(projectDir: string): string {
    return `${projectDir}pages.json`;
  }

  /**
   * 同步作品下全部页面元数据到 JSON 文件
   * 从数据库读取该作品最新页面列表，整体覆写作品文件夹中的 pages.json，
   * 新建/修改/移动/删除页面后调用，保证 JSON 与数据库一致。
   * @param projectId - 作品 ID（为空时无作品文件夹，跳过同步）
   */
  private syncPagesJson(projectId: string | null): void {
    if (!projectId) return;
    try {
      const project = this.projectDao.findById(projectId);
      if (!project) return;
      const pages = this.pageDao.findBy("project_id", projectId);
      const jsonPath = this.getPagesJsonFilePath(project.file_path);
      fileService.writeFile(jsonPath, JSON.stringify(pages, null, 2));
    } catch (error) {
      Logger.error("同步页面 JSON 文件失败", { error: String(error), projectId });
    }
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
   * 递归过滤页面树，只保留指定 pageType 且未删除的节点
   * （软删除页面 status = 'deleted'，不再展示；用 !== 判断以兼容历史 NULL 数据）
   */
  private filterTreeByPageType(nodes: PageTree[], pageType: PAGE_TYPE): PageTree[] {
    return nodes
      .filter(node => node.page_type === pageType && node.status !== "deleted")
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
      // 同级末尾追加，保证兄弟节点顺序稳定
      const orderIndex =
        this.pageDao.getMaxOrderIndex(data.projectId ?? "", data.parentId) + 1;

      // 1. 写入 md 文件
      fileService.writeFile(filePath, data.content || "");

      // 2. 保存到页面表（转换为 db 类型）
      const pageCreate: PageCreate = {
        id: pageId,
        project_id: data.projectId,
        title: data.title,
        file_path: filePath,
        order_index: orderIndex,
        parent_page_id: data.parentId,
        word_count: 0,
        ai_summary: null,
        metadata: data.metadata,
        status: "active",
        page_type: pageType,
      };
      this.pageDao.create(pageCreate);

      // 3. 同步页面元数据到作品文件夹中的 pages.json
      this.syncPagesJson(data.projectId);

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
      // 仅写入调用方实际传入的字段：BaseDao.update 会将对象中值为 undefined 的键
      // 序列化为 NULL，无条件传入 metadata/status 会把未更新的字段清空
      //（历史 bug：编辑器保存正文时把 status/metadata 写成 NULL，导致状态丢失）
      const pageUpdate: PageUpdate = {};
      if (updateData.title !== undefined) {
        pageUpdate.title = updateData.title;
      }
      if (updateData.metadata !== undefined) {
        pageUpdate.metadata = updateData.metadata;
      }
      if (updateData.status !== undefined) {
        pageUpdate.status = updateData.status;
      }
      let changes = 0;
      if (Object.keys(pageUpdate).length > 0) {
        changes = this.pageDao.update(id, pageUpdate);
      }

      if (changes > 0) {
        // 同步页面元数据到作品文件夹中的 pages.json
        this.syncPagesJson(existing.project_id);
        Logger.info("更新页面成功", { id });
      } else if (updateData.content !== undefined) {
        // 仅更新正文（md 文件）时无表字段变更，同样视为保存成功
        Logger.info("更新页面正文成功", { id });
        return 1;
      }
      return changes;
    } catch (error) {
      Logger.error("更新页面失败", { error: String(error), id: data.id, data });
      throw error;
    }
  }

  /**
   * 移动页面
   * 变更 parent_page_id 与 order_index（移到目标父级末尾；parentId 为 null 移到根）
   */
  public movePage(data: MovePageInput): number {
    try {
      const existing = this.pageDao.findById(data.id);
      if (!existing) {
        Logger.warn("移动页面失败，页面不存在", { id: data.id });
        return 0;
      }

      const parentId = data.parentId ?? null;
      const orderIndex =
        this.pageDao.getMaxOrderIndex(existing.project_id ?? "", parentId) + 1;
      const pageUpdate: PageUpdate = {
        parent_page_id: parentId,
        order_index: orderIndex,
      };
      const changes = this.pageDao.update(data.id, pageUpdate);

      if (changes > 0) {
        // 同步页面元数据到作品文件夹中的 pages.json（parent_page_id/order_index 变更）
        this.syncPagesJson(existing.project_id);
        Logger.info("移动页面成功", { id: data.id, parentId });
      }
      return changes;
    } catch (error) {
      Logger.error("移动页面失败", { error: String(error), data });
      throw error;
    }
  }

  /**
   * 收集某页所有后代页 ID（含间接后代）
   */
  private collectDescendantIds(id: string): string[] {
    const ids: string[] = [];
    const visit = (pid: string) => {
      for (const child of this.pageDao.findBy("parent_page_id", pid)) {
        ids.push(child.id);
        visit(child.id);
      }
    };
    visit(id);
    return ids;
  }

  /**
   * 删除页面（软删除，与作品删除保持一致）
   * 1. 将自身与所有后代页状态标记为 deleted（保留 md 文件与数据库记录）
   * 2. 同步页面元数据到作品文件夹中的 pages.json（记录 deleted 状态）
   */
  public deletePage(id: string): number {
    try {
      const existing = this.pageDao.findById(id);
      if (!existing) {
        Logger.warn("删除页面失败，页面不存在", { id });
        return 0;
      }

      // 1. 软删除：标记自身与所有后代页状态为 deleted（保留 md 文件）
      const ids = [id, ...this.collectDescendantIds(id)];
      const changes = this.pageDao.transaction(() => {
        let updated = 0;
        for (const pid of ids) {
          updated += this.pageDao.update(pid, { status: "deleted" });
        }
        return updated;
      });

      // 2. 同步页面元数据到作品文件夹中的 pages.json（记录删除状态）
      this.syncPagesJson(existing.project_id);

      Logger.info("删除页面成功", { id, affected: changes });
      return changes;
    } catch (error) {
      Logger.error("删除页面失败", { error: String(error), id });
      throw error;
    }
  }
}

export default PageService;

export const pageService = PageService.getInstance();