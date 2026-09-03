import { PageDao, ProjectDao } from "@/main/core/db";
import type {
  ProjectCreate,
  ProjectUpdate,
  ProjectQuery,
  ProjectDetail,
  ProjectReloadResult,
} from "@/main/types/db";
import { PaginationResult } from "@/shared/utils/pagination";
import { Logger } from "@/main/utils/logger";
import { fileService } from "@/main/core/services/base/file.service";
import { NodeCryptoUtil } from "@/main/utils";
import { PROJECT_DIR } from "@/main/constants/folder.constants";
import { PAGE_TYPE } from "@/shared/enums";

/** 从 project.json 解析出的作品行（字段与 projects 表对齐） */
interface ProjectRow {
  id: string;
  name: string;
  file_path: string;
  description: string | null;
  type: string | null;
  status: "active" | "deleted";
  created_at: string;
  updated_at: string;
  ai_summary: string | null;
  structure: string | null;
  metadata: string;
  is_pinned: boolean;
}

/** 从 pages.json 解析出的页面行（字段与 pages 表对齐） */
interface PageRow {
  id: string;
  project_id: string | null;
  title: string;
  file_path: string;
  order_index: number;
  parent_page_id: string | null;
  word_count: number;
  ai_summary: string | null;
  page_type: string;
  metadata: string;
  status: "active" | "deleted";
  created_at: string;
  updated_at: string;
}

/**
 * 作品服务
 * 编排两层存储：
 *   1. 作品文件夹（fileService, workspace/projects/{timestamp}/）
 *   2. 作品表（ProjectDao, projects 表）
 * 创建/更新/删除时同步元数据到作品文件夹中的 project.json 文件
 *
 * 文件夹命名规则：projects/{timestamp}/
 * 作品名禁止包含特殊字符：\ / : * ? " < > |
 */
class ProjectService {
  private static instance: ProjectService | null = null;
  private projectDao: ProjectDao;
  private pageDao: PageDao;

  /** 特殊字符正则（Windows 文件夹名非法字符） */
  private readonly INVALID_CHARS_REGEX = /[\\/:*?"<>|]/g;

  private constructor() {
    this.projectDao = new ProjectDao();
    this.pageDao = new PageDao();
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
   * 校验作品名并替换特殊字符为下划线
   * @param name - 原始作品名
   * @returns 清洗后的作品名
   */
  private sanitizeName(name: string): string {
    return name.replace(this.INVALID_CHARS_REGEX, "_").trim();
  }

  /**
   * 获取作品 JSON 元数据文件路径
   * @param filePath - 作品文件夹路径
   * @returns project.json 的完整路径
   */
  private getProjectJsonFilePath(filePath: string): string {
    return `${filePath}project.json`;
  }

  /**
   * 同步作品元数据到 JSON 文件
   * 从数据库读取最新作品信息，写入到作品文件夹中的 project.json
   * @param id - 作品 ID
   */
  private syncProjectJson(id: string): void {
    try {
      const project = this.projectDao.findById(id);
      if (project) {
        const jsonPath = this.getProjectJsonFilePath(project.file_path);
        fileService.writeFile(jsonPath, JSON.stringify(project, null, 2));
      }
    } catch (error) {
      Logger.error("同步作品 JSON 文件失败", { error: String(error), id });
    }
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
   * 1. 校验并清洗作品名
   * 2. 创建作品文件夹
   * 3. 保存到数据库
   * 4. 同步元数据到 project.json
   * @param data 作品创建参数
   * @returns 新创建的作品 ID
   */
  public createProject(data: ProjectCreate): string {
    try {
      const id = data.id || NodeCryptoUtil.generateUUID();
      const sanitizedName = this.sanitizeName(data.name);
      const timestamp = Math.floor(Date.now() / 1000);
      const filePath = `projects/${timestamp}/`;
      // 1. 创建作品文件夹
      fileService.ensureDir(filePath);

      // 2. 保存到数据库
      const { tags, ...projectData } = data;
      const projectCreate: ProjectCreate = {
        ...projectData,
        id,
        name: sanitizedName,
        file_path: filePath,
      };
      const createdId = this.projectDao.create(projectCreate);

      if (tags && tags.length > 0) {
        this.projectDao.saveTags(createdId, tags);
      }

      // 3. 同步元数据到 JSON 文件
      this.syncProjectJson(createdId);

      Logger.info("创建作品成功", { id: createdId, name: sanitizedName, filePath });
      return createdId;
    } catch (error) {
      Logger.error("创建作品失败", { error: String(error), data });
      throw error;
    }
  }

  /**
   * 更新作品
   * 名称变更时仅更新数据库记录，不改变文件夹路径
   * 更新后同步元数据到 project.json
   * @param id 作品 ID
   * @param data 作品更新参数
   * @returns 受影响的行数
   */
  public updateProject(id: string, data: ProjectUpdate): number {
    try {
      const { tags, ...projectData } = data;
      const existing = this.projectDao.findById(id);
      if (!existing) {
        Logger.warn("更新作品失败，作品不存在", { id });
        return 0;
      }

      const updateData: ProjectUpdate = { ...projectData };

      // 名称变更时仅更新名称，不改变文件夹路径
      if (data.name && data.name !== existing.name) {
        updateData.name = this.sanitizeName(data.name);
      }

      const changes = this.projectDao.update(id, updateData);

      if (changes > 0) {
        if (tags !== undefined) {
          this.projectDao.saveTags(id, tags);
        }
        // 3. 同步元数据到 JSON 文件
        this.syncProjectJson(id);
        Logger.info("更新作品成功", { id });
      }
      return changes;
    } catch (error) {
      Logger.error("更新作品失败", { error: String(error), id, data });
      throw error;
    }
  }

  /**
   * 删除作品（软删除）
   * 仅标记 status = 'deleted'，保留文件夹和文件
   * 删除后同步元数据到 project.json（反映已删除状态）
   * @param id 作品 ID
   * @returns 受影响的行数
   */
  public deleteProject(id: string): number {
    try {
      const changes = this.projectDao.update(id, { status: 'deleted' } as ProjectUpdate);

      if (changes > 0) {
        // 同步元数据到 JSON 文件（反映已删除状态）
        this.syncProjectJson(id);
        Logger.info("软删除作品成功", { id });
      }
      return changes;
    } catch (error) {
      Logger.error("软删除作品失败", { id, error: String(error) });
      throw error;
    }
  }

  /**
   * 设置作品置顶状态
   * @param id 作品 ID
   * @param isPinned 是否置顶
   * @returns 受影响的行数
   */
  public setProjectPinned(id: string, isPinned: boolean): number {
    try {
      const changes = this.projectDao.update(id, { is_pinned: isPinned } as ProjectUpdate);
      if (changes > 0) {
        this.syncProjectJson(id);
        Logger.info("更新作品置顶状态成功", { id, isPinned });
      }
      return changes;
    } catch (error) {
      Logger.error("更新作品置顶状态失败", { id, isPinned, error: String(error) });
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

  // ==================== 重建索引：从磁盘重载项目数据 ====================

  /**
   * 根据作品文件夹中的 project.json / pages.json 重置 projects 与 pages 表
   * 逻辑模式参考日志的 resetJournalTable：扫描磁盘 → 事务内清空重放。
   * 注意：
   *   1. 保留原 ID 与 created_at/updated_at（tagged_items 标签关联依赖 ID）
   *   2. project_chunks 随 projects 外键级联清理（派生数据，由智能任务重建）
   *   3. 磁盘上不存在的作品/页面记录会被删除
   * @returns 重载的作品与页面数量
   */
  public resetProjectTable(): ProjectReloadResult {
    try {
      const folders = this.scanProjectFolders();

      const result = this.projectDao.transaction(() => {
        // 清空旧数据（pages 先于 projects，避免外键置空/级联）
        this.projectDao.execute("DELETE FROM pages");
        this.projectDao.execute("DELETE FROM project_chunks");
        this.projectDao.execute("DELETE FROM projects");

        // 重放作品
        for (const { project } of folders) {
          this.insertProjectRow(project);
        }

        // 重放页面（project_id 必须指向已重放的作品，否则跳过防外键违约）
        const loadedProjectIds = new Set(folders.map((f) => f.project.id));
        const allPages = folders
          .flatMap((f) => f.pages)
          .filter((p) => !p.project_id || loadedProjectIds.has(p.project_id));
        const pageCount = this.insertPageRows(allPages);

        // 清理已不存在作品的孤儿标签关联
        this.projectDao.execute(
          "DELETE FROM tagged_items WHERE entity_type = 'project' AND entity_id NOT IN (SELECT id FROM projects)",
        );

        // 重建 FTS 全文索引（external-content 表 DELETE/INSERT 不会自动同步，需手动 rebuild）
        this.projectDao.execute("INSERT INTO pages_fts(pages_fts) VALUES('rebuild')");
        this.projectDao.execute("INSERT INTO projects_fts(projects_fts) VALUES('rebuild')");

        return { projects: folders.length, pages: pageCount };
      });

      Logger.info("projects/pages 表重置完成", result);
      return result;
    } catch (error) {
      Logger.error("重置 projects/pages 表失败", { error: String(error) });
      throw error;
    }
  }

  /**
   * 扫描 projects/ 目录下的作品文件夹（含 project.json 的直接子目录），
   * 读取 project.json 与同级 pages.json 构建重放数据
   */
  private scanProjectFolders(): { project: ProjectRow; pages: PageRow[] }[] {
    const jsonFiles = fileService
      .listFiles(`${PROJECT_DIR}/`, ".json")
      .map((p) => p.replace(/\\/g, "/"));

    const results: { project: ProjectRow; pages: PageRow[] }[] = [];
    const seenIds = new Set<string>();

    for (const jsonFile of jsonFiles) {
      if (!/^projects\/[^/]+\/project\.json$/.test(jsonFile)) continue;

      const projectDir = jsonFile.slice(0, -"project.json".length);
      try {
        const project = this.parseProjectJson(jsonFile, projectDir);
        if (seenIds.has(project.id)) {
          Logger.warn("磁盘上存在重复的作品 ID，跳过后续文件夹", {
            id: project.id,
            projectDir,
          });
          continue;
        }
        seenIds.add(project.id);
        const pages = this.parsePagesJson(`${projectDir}pages.json`);
        results.push({ project, pages });
      } catch (error) {
        Logger.warn("解析作品数据失败，跳过该文件夹", {
          jsonFile,
          error: String(error),
        });
      }
    }

    return results;
  }

  /**
   * 解析 project.json 为作品行
   * file_path 以磁盘实际文件夹为准（支持文件夹被手动重命名的场景）
   */
  private parseProjectJson(
    jsonPath: string,
    projectDir: string,
  ): ProjectRow {
    const raw = JSON.parse(fileService.readFile(jsonPath)) as Record<string, unknown>;
    if (
      typeof raw.id !== "string" || !raw.id ||
      typeof raw.name !== "string" || !raw.name
    ) {
      throw new Error("project.json 缺少必填字段 id/name");
    }
    const now = new Date().toISOString();
    return {
      id: raw.id,
      name: raw.name,
      file_path: projectDir,
      description: typeof raw.description === "string" ? raw.description : null,
      type: typeof raw.type === "string" ? raw.type : null,
      status: raw.status === "deleted" ? "deleted" : "active",
      created_at: typeof raw.created_at === "string" ? raw.created_at : now,
      updated_at: typeof raw.updated_at === "string" ? raw.updated_at : now,
      ai_summary: typeof raw.ai_summary === "string" ? raw.ai_summary : null,
      structure: this.serializeJsonText(raw.structure, null),
      metadata: this.serializeJsonText(raw.metadata, "{}") ?? "{}",
      is_pinned: raw.is_pinned === true || raw.is_pinned === 1,
    };
  }

  /**
   * 解析 pages.json 为页面行数组（文件不存在时返回空数组）
   * 缺少必填字段（id/title/file_path）的条目跳过
   */
  private parsePagesJson(pagesJsonPath: string): PageRow[] {
    if (!fileService.exists(pagesJsonPath)) return [];

    const rawList = JSON.parse(
      fileService.readFile(pagesJsonPath),
    ) as Record<string, unknown>[];
    const now = new Date().toISOString();
    const pages: PageRow[] = [];

    for (const raw of rawList) {
      if (
        typeof raw.id !== "string" || !raw.id ||
        typeof raw.title !== "string" || !raw.title ||
        typeof raw.file_path !== "string" || !raw.file_path
      ) {
        Logger.warn("pages.json 条目缺少必填字段，跳过", { id: raw.id });
        continue;
      }
      pages.push({
        id: raw.id,
        project_id: typeof raw.project_id === "string" ? raw.project_id : null,
        title: raw.title,
        file_path: raw.file_path,
        order_index: typeof raw.order_index === "number" ? raw.order_index : 0,
        parent_page_id:
          typeof raw.parent_page_id === "string" ? raw.parent_page_id : null,
        word_count: typeof raw.word_count === "number" ? raw.word_count : 0,
        ai_summary: typeof raw.ai_summary === "string" ? raw.ai_summary : null,
        page_type:
          typeof raw.page_type === "string" ? raw.page_type : PAGE_TYPE.PROJECT_CHAPTER,
        metadata: this.serializeJsonText(raw.metadata, "{}") ?? "{}",
        status: raw.status === "deleted" ? "deleted" : "active",
        created_at: typeof raw.created_at === "string" ? raw.created_at : now,
        updated_at: typeof raw.updated_at === "string" ? raw.updated_at : now,
      });
    }

    return pages;
  }

  /** JSON 文本字段序列化：字符串原样返回，对象序列化，空值返回兜底值 */
  private serializeJsonText(
    value: unknown,
    fallback: string | null,
  ): string | null {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  }

  /** 插入作品行（显式列清单，保留原时间戳，绕过 BaseDao.create 的时间戳覆写） */
  private insertProjectRow(project: ProjectRow): void {
    this.projectDao.execute(
      `INSERT INTO projects (id, name, file_path, description, type, status, created_at, updated_at, ai_summary, structure, metadata, is_pinned)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project.id,
        project.name,
        project.file_path,
        project.description,
        project.type,
        project.status,
        project.created_at,
        project.updated_at,
        project.ai_summary,
        project.structure,
        project.metadata,
        project.is_pinned ? 1 : 0,
      ],
    );
  }

  /**
   * 按拓扑顺序插入页面（父节点先于子节点，满足 parent_page_id 外键）
   * 父节点缺失的页面跳过并告警
   * @returns 实际插入的页面数
   */
  private insertPageRows(pages: PageRow[]): number {
    const pending = [...pages];
    const insertedIds = new Set<string>();
    let progressed = true;

    while (pending.length > 0 && progressed) {
      progressed = false;
      for (let i = pending.length - 1; i >= 0; i--) {
        const page = pending[i];
        if (page.parent_page_id && !insertedIds.has(page.parent_page_id)) {
          continue;
        }
        this.insertPageRow(page);
        insertedIds.add(page.id);
        pending.splice(i, 1);
        progressed = true;
      }
    }

    if (pending.length > 0) {
      Logger.warn("部分页面因父节点缺失被跳过", { count: pending.length });
    }
    return insertedIds.size;
  }

  /** 插入页面行（显式列清单，保留原时间戳） */
  private insertPageRow(page: PageRow): void {
    this.pageDao.execute(
      `INSERT INTO pages (id, project_id, title, file_path, order_index, parent_page_id, word_count, ai_summary, page_type, metadata, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        page.id,
        page.project_id,
        page.title,
        page.file_path,
        page.order_index,
        page.parent_page_id,
        page.word_count,
        page.ai_summary,
        page.page_type,
        page.metadata,
        page.status,
        page.created_at,
        page.updated_at,
      ],
    );
  }
}

export default ProjectService;

export const projectService = ProjectService.getInstance();