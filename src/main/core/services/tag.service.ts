import { TagDao } from "@/main/core/db";
import { TaggedItemDao } from "@/main/core/db";
import type {
    Tag,
    TagCreate,
    TagUpdate,
    TagQuery,
    TagDetail,
    TagId,
} from "@/main/types/db";
import { Logger } from "@/main/utils/logger";

/**
 * 标签服务
 * 提供标签的 CRUD 操作及业务逻辑封装
 */
class TagService {
    private static instance: TagService | null = null;
    private tagDao: TagDao;
    private taggedItemDao: TaggedItemDao;

    private constructor() {
        this.tagDao = new TagDao();
        this.taggedItemDao = new TaggedItemDao();
    }

    /**
     * 获取 TagService 单例实例
     */
    public static getInstance(): TagService {
        if (!TagService.instance) {
            TagService.instance = new TagService();
        }
        return TagService.instance;
    }

    /**
     * 根据 ID 获取标签
     * @param id 标签 ID
     * @returns 标签对象，不存在时返回 null
     */
    public getDetailById(id: TagId): TagDetail | null {
        try {
            return this.tagDao.getDetailById(id);
        } catch (error) {
            Logger.error("根据 ID 获取标签失败", { error: String(error), id });
            throw error;
        }
    }

    /**
     * 通用名称查询：支持精确或模糊匹配
     * @param name 名称或关键词
     * @param options.exact 是否精确匹配（默认 false）
     * @param options.limit 最大返回条数（仅模糊匹配时生效，默认 50）
     */
    public findTags(
        name: string,
        options: { exact?: boolean; limit?: number } = {},
    ): Tag[] {
        try {
            const { exact = false, limit = 50 } = options;
            if (exact) {
                const t = this.tagDao.findByName(name);
                return t ? [t] : [];
            }
            return this.tagDao.findByNameLike(name, limit);
        } catch (error) {
            Logger.error("查询标签失败", { error: String(error), name, options });
            throw error;
        }
    }

    /**
     * 获取标签及其使用次数
     * @param entityType 实体类型过滤（可选）
     * @returns 标签及其使用次数列表
     */
    public getAllTags(entityType?: string): TagDetail[] {
        try {
            return this.tagDao.getAllDetail(entityType);
        } catch (error) {
            Logger.error("获取标签使用次数失败", { error: String(error), entityType });
            throw error;
        }
    }

    /**
     * 分页查询标签
     * @param params.page 页码（从 1 开始），默认 1
     * @param params.pageSize 每页记录数，默认 50
     * @param params.orderBy 排序字段，默认 'created_at'
     * @param params.orderDir 排序方向，默认 'ASC'
     * @param params.conditions 查询条件
     * @returns 分页结果
     */
    public paginateTags(params: {
        page?: number;
        pageSize?: number;
        orderBy?: string;
        orderDir?: "ASC" | "DESC";
        conditions?: TagQuery;
    }) {
        try {
            return this.tagDao.paginate({
                ...params,
                conditions: params.conditions as Record<string, unknown> | undefined,
            });
        } catch (error) {
            Logger.error("分页查询标签失败", { error: String(error), params });
            throw error;
        }
    }

    /**
     * 创建单个或批量标签
     * - 单个创建：若名称已存在，直接返回已有标签的 ID
     * - 批量创建：逐条检查，已存在的返回原 ID，不存在的创建新标签
     * @param data 单个 TagCreate 或 TagCreate 数组
     * @returns 新创建的 ID（单个）或 ID 数组（批量）
     */
    public createTags(data: TagCreate | TagCreate[]): string | string[] {
        try {
            if (Array.isArray(data)) {
                if (data.length === 0) return [];
                return this.tagDao.transaction(() => {
                    const ids: string[] = [];
                    for (const item of data) {
                        const existing = this.tagDao.findByName(item.name);
                        if (existing) {
                            ids.push(existing.id);
                        } else {
                            ids.push(this.tagDao.create(item));
                        }
                    }
                    Logger.info("批量创建标签成功", { count: ids.length });
                    return ids;
                });
            }
            const existing = this.tagDao.findByName(data.name);
            if (existing) {
                Logger.info("标签已存在，返回已有 ID", { id: existing.id, name: data.name });
                return existing.id;
            }
            const id = this.tagDao.create(data);
            Logger.info("创建标签成功", { id, name: data.name });
            return id;
        } catch (error) {
            Logger.error("创建标签失败", { error: String(error), data });
            throw error;
        }
    }

    /**
     * 更新标签（单个或批量）
     * - 单个：传入 `{ id, data }`，返回受影响行数
     * - 批量：传入 `[{ id, data }, ...]`，在事务中逐条更新，返回每项行数数组
     * @param items 单个或数组的更新项
     * @returns 单个传入返回 number，数组传入返回 number[]
     */
    public updateTag(
        items: { id: TagId; data: TagUpdate } | { id: TagId; data: TagUpdate }[],
    ): number | number[] {
        try {
            const list = Array.isArray(items) ? items : [items];
            if (list.length === 0) return Array.isArray(items) ? [] : 0;
            const results = this.tagDao.transaction(() => {
                return list.map(({ id, data }) => this.tagDao.update(id, data));
            });
            Logger.info("更新标签成功", { count: list.length });
            return Array.isArray(items) ? results : results[0];
        } catch (error) {
            Logger.error("更新标签失败", { error: String(error), items });
            throw error;
        }
    }

    /**
     * 删除标签（单个或批量），同时清理标签与实体的关联关系
     * @param ids 单个标签 ID 或 ID 数组
     * @returns 单个传入返回受影响行数，数组传入返回总行数
     */
    public deleteTag(ids: TagId | TagId[]): number {
        try {
            const idList = Array.isArray(ids) ? ids : [ids];
            if (idList.length === 0) return 0;
            return this.tagDao.transaction(() => {
                for (const tagId of idList) {
                    this.taggedItemDao.deleteBy('tag_id', tagId);
                }
                const changes = this.tagDao.deleteByIds(idList);
                Logger.info("删除标签成功", { count: changes });
                return changes;
            });
        } catch (error) {
            Logger.error("删除标签失败", { error: String(error), ids });
            throw error;
        }
    }
}

export default TagService;
export const tagService = TagService.getInstance();
