import { computed } from "vue";
import { useTagStore } from "@/renderer/store/tag.store";
import type {
  Tag,
  TagCreate,
  TagUpdate,
  TagQuery,
  TagDetail,
  TagId,
} from "@/shared/types";
import { logger } from "@/renderer/utils/logger.utils";

export function useTag() {
  const store = useTagStore();

  // 响应式状态
  const tags = computed(() => store.tags);
  const allTags = computed(() => store.allTags);
  const currentTag = computed(() => store.currentTag);
  const loading = computed(() => store.loading);
  const errorCode = computed(() => store.errorCode);
  const errorMessage = computed(() => store.errorMessage);
  const pagination = computed(() => store.pagination);
  const hasError = computed(() => store.hasError);
  const isReady = computed(() => store.isReady);

  /**
   * 分页查询标签
   */
  const paginateTags = async (params: {
    page?: number;
    pageSize?: number;
    orderBy?: string;
    orderDir?: "ASC" | "DESC";
    conditions?: TagQuery;
  }): Promise<void> => {
    try {
      await store.paginateTags(params);
      logger.info("分页查询标签成功", {
        page: params.page,
        pageSize: params.pageSize,
        count: tags.value.length,
      });
    } catch (error) {
      logger.error("分页查询标签失败", { error, params });
    }
  };

  /**
   * 获取标签详情
   */
  const getTagDetail = async (id: TagId): Promise<TagDetail | null> => {
    try {
      const result = await store.getTagDetail(id);
      if (result) {
        logger.info("获取标签详情成功", { id });
      }
      return result;
    } catch (error) {
      logger.error("获取标签详情失败", { error, id });
      return null;
    }
  };

  /**
   * 查询标签（模糊搜索）
   */
  const findTags = async (
    name: string,
    options?: { exact?: boolean; limit?: number },
  ): Promise<Tag[]> => {
    try {
      const result = await store.findTags(name, options);
      logger.info("查询标签成功", { name, count: result.length });
      return result;
    } catch (error) {
      logger.error("查询标签失败", { error, name });
      return [];
    }
  };

  /**
   * 获取所有标签及使用次数
   */
  const getAllTags = async (entityType?: string): Promise<void> => {
    try {
      await store.getAllTags(entityType);
      logger.info("获取所有标签成功", { count: allTags.value.length });
    } catch (error) {
      logger.error("获取所有标签失败", { error });
    }
  };

  /**
   * 创建单个或批量标签
   */
  const createTags = async (
    data: TagCreate | TagCreate[],
  ): Promise<string | string[] | null> => {
    try {
      const ids = await store.createTags(data);
      if (ids) {
        logger.info("创建标签成功", { ids });
      }
      return ids;
    } catch (error) {
      logger.error("创建标签失败", { error, data });
      return null;
    }
  };

  /**
   * 更新单个或批量标签
   */
  const updateTag = async (
    items:
      | { id: TagId; data: TagUpdate }
      | { id: TagId; data: TagUpdate }[],
  ): Promise<boolean> => {
    try {
      const success = await store.updateTag(items);
      if (success) {
        logger.info("更新标签成功", { items });
      }
      return success;
    } catch (error) {
      logger.error("更新标签失败", { error, items });
      return false;
    }
  };

  /**
   * 删除单个或批量标签
   */
  const deleteTag = async (ids: TagId | TagId[]): Promise<boolean> => {
    try {
      const success = await store.deleteTag(ids);
      if (success) {
        logger.info("删除标签成功", { ids });
      }
      return success;
    } catch (error) {
      logger.error("删除标签失败", { error, ids });
      return false;
    }
  };

  return {
    // 状态
    tags,
    allTags,
    currentTag,
    loading,
    errorCode,
    errorMessage,
    pagination,
    hasError,
    isReady,
    // 方法
    paginateTags,
    getTagDetail,
    findTags,
    getAllTags,
    createTags,
    updateTag,
    deleteTag,
  };
}