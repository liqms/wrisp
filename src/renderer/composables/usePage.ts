import { computed } from "vue";
import { usePageStore } from "@/renderer/store/page.store";
import type { CreatePageInput, UpdatePageInput, PageQuery } from "@/shared/types/page.types";
import type { Page, PageTree } from "@/main/types/db";
import type { PageType } from "@/shared/enums";
import { logger } from "@/renderer/utils/logger.utils";

export function usePage() {
  const store = usePageStore();

  // 响应式状态
  const pages = computed(() => store.pages);
  const currentPage = computed(() => store.currentPage);
  const pageTree = computed(() => store.pageTree);
  const loading = computed(() => store.loading);
  const errorCode = computed(() => store.errorCode);
  const errorMessage = computed(() => store.errorMessage);
  const pagination = computed(() => store.pagination);
  const hasError = computed(() => store.hasError);
  const isReady = computed(() => store.isReady);

  /**
   * 根据 ID 获取页面详情
   */
  const getPage = async (id: string): Promise<Page | null> => {
    try {
      const result = await store.getPage(id);
      if (result) {
        logger.info("获取页面详情成功", { id });
      }
      return result;
    } catch (error) {
      logger.error("获取页面详情失败", { error, id });
      return null;
    }
  };

  /**
   * 分页查询页面列表
   */
  const paginatePages = async (params: {
    page?: number;
    pageSize?: number;
    orderBy?: string;
    orderDir?: "ASC" | "DESC";
    conditions?: PageQuery;
  }): Promise<void> => {
    try {
      await store.paginatePages(params);
      logger.info("分页查询页面成功", {
        page: params.page,
        pageSize: params.pageSize,
        count: pages.value.length,
      });
    } catch (error) {
      logger.error("分页查询页面失败", { error, params });
    }
  };

  /**
   * 获取项目页面树
   */
  const getPageTree = async (projectId: string, pageType: PageType): Promise<PageTree[] | null> => {
    try {
      const result = await store.getPageTree(projectId, pageType);
      if (result) {
        logger.info("获取页面树成功", { projectId, pageType, count: result.length });
      }
      return result;
    } catch (error) {
      logger.error("获取页面树失败", { error, projectId, pageType });
      return null;
    }
  };

  /**
   * 创建页面
   */
  const createPage = async (data: CreatePageInput): Promise<string | null> => {
    try {
      const id = await store.createPage(data);
      if (id) {
        logger.info("创建页面成功", { id, title: data.title });
      }
      return id;
    } catch (error) {
      logger.error("创建页面失败", { error, data });
      return null;
    }
  };

  /**
   * 更新页面
   */
  const updatePage = async (data: UpdatePageInput): Promise<boolean> => {
    try {
      const success = await store.updatePage(data);
      if (success) {
        logger.info("更新页面成功", { id: data.id });
      }
      return success;
    } catch (error) {
      logger.error("更新页面失败", { error, id: data.id, data });
      return false;
    }
  };

  /**
   * 删除页面
   */
  const deletePage = async (id: string): Promise<boolean> => {
    try {
      const success = await store.deletePage(id);
      if (success) {
        logger.info("删除页面成功", { id });
      }
      return success;
    } catch (error) {
      logger.error("删除页面失败", { error, id });
      return false;
    }
  };

  /**
   * 清空错误状态
   */
  const clearError = () => {
    store.clearError();
  };

  return {
    // 状态
    pages,
    currentPage,
    pageTree,
    loading,
    errorCode,
    errorMessage,
    pagination,
    // 计算属性
    hasError,
    isReady,
    // 方法
    getPage,
    paginatePages,
    getPageTree,
    createPage,
    updatePage,
    deletePage,
    clearError,
  };
}
