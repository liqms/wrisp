import { ProjectDao } from "@/main/core/db";
import type {
  ProjectCreate,
  ProjectUpdate,
  ProjectQuery,
  ProjectDetail,
} from "@/main/types/db";
import { PaginationResult } from "@/shared/utils/pagination";
import { Logger } from "@/main/utils/logger";
import { fileService } from "@/main/core/services/base/file.service";
import { NodeCryptoUtil } from "@/main/utils";

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

  /** 特殊字符正则（Windows 文件夹名非法字符） */
  private readonly INVALID_CHARS_REGEX = /[\\/:*?"<>|]/g;

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