import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { ApiResponse } from "@/shared/types";
import type { CreatePageInput, UpdatePageInput, PageQuery } from "@/shared/types/page.types";
import type { Page, PageTree } from "@/main/types/db";
import type { PaginationResult } from "@/shared/utils/pagination";
import { ErrorCode, type PageType } from "@/shared/enums";
import { handleApiError } from "@/renderer/utils/error.utils";

export const usePageStore = defineStore("page", () => {
  const pages = ref<Page[]>([]);
  const currentPage = ref<Page | null>(null);
  const pageTree = ref<PageTree[]>([]);
  const loading = ref(false);
  const errorCode = ref<ErrorCode | null>(null);
  const errorMessage = ref<string | null>(null);
  const pagination = ref<{
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    startIndex: number;
    endIndex: number;
  } | null>(null);

  const hasError = computed(() => errorCode.value !== null);
  const isReady = computed(() => !loading.value && !hasError.value);

  /**
   * 根据 ID 获取页面详情
   */
  const getPage = async (id: string): Promise<Page | null> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.page.get(
        id,
      )) as ApiResponse<Page | null>;

      if (response.success && response.data) {
        currentPage.value = response.data as Page;
        return currentPage.value;
      } else {
        errorCode.value = response.code;
        errorMessage.value = handleApiError(response);
        return null;
      }
    } catch {
      errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
      errorMessage.value = handleApiError({
        success: false,
        code: errorCode.value,
      });
      return null;
    } finally {
      loading.value = false;
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
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.page.paginate(
        params,
      )) as ApiResponse<PaginationResult<Page>>;

      if (response.success && response.data) {
        const result = response.data as PaginationResult<Page>;
        pages.value = result.data;
        pagination.value = {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
          hasNext: result.hasNext,
          hasPrev: result.hasPrev,
          startIndex: result.startIndex,
          endIndex: result.endIndex,
        };
      } else {
        errorCode.value = response.code;
        errorMessage.value = handleApiError(response);
      }
    } catch {
      errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
      errorMessage.value = handleApiError({
        success: false,
        code: errorCode.value,
      });
    } finally {
      loading.value = false;
    }
  };

  /**
   * 获取项目页面树
   */
  const getPageTree = async (projectId: string, pageType: PageType): Promise<PageTree[] | null> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.page.getTree(
        projectId,
        pageType,
      )) as ApiResponse<PageTree[]>;

      if (response.success && response.data) {
        pageTree.value = response.data as PageTree[];
        return pageTree.value;
      } else {
        errorCode.value = response.code;
        errorMessage.value = handleApiError(response);
        return null;
      }
    } catch {
      errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
      errorMessage.value = handleApiError({
        success: false,
        code: errorCode.value,
      });
      return null;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 创建页面
   */
  const createPage = async (data: CreatePageInput): Promise<string | null> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.page.create(
        data,
      )) as ApiResponse<string>;

      if (response.success && response.data) {
        return response.data as string;
      } else {
        errorCode.value = response.code;
        errorMessage.value = handleApiError(response);
        return null;
      }
    } catch {
      errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
      errorMessage.value = handleApiError({
        success: false,
        code: errorCode.value,
      });
      return null;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 更新页面
   */
  const updatePage = async (data: UpdatePageInput): Promise<boolean> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.page.update(
        data,
      )) as ApiResponse<number>;

      if (response.success && response.data && (response.data as number) > 0) {
        // 重新获取更新后的页面详情
        const detailResponse = await window.electronAPI.page.get(data.id) as ApiResponse<Page | null>;
        if (detailResponse.success && detailResponse.data) {
          const detail = detailResponse.data as Page;
          if (currentPage.value && currentPage.value.id === data.id) {
            currentPage.value = detail;
          }
          pages.value = pages.value.map((p) =>
            p.id === data.id ? detail : p,
          );
        }
        return true;
      } else {
        errorCode.value = response.code;
        errorMessage.value = handleApiError(response);
        return false;
      }
    } catch {
      errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
      errorMessage.value = handleApiError({
        success: false,
        code: errorCode.value,
      });
      return false;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 删除页面
   */
  const deletePage = async (id: string): Promise<boolean> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.page.delete(
        id,
      )) as ApiResponse<number>;

      if (response.success && response.data && (response.data as number) > 0) {
        // 同步更新本地状态
        pages.value = pages.value.filter((p) => p.id !== id);
        if (currentPage.value && currentPage.value.id === id) {
          currentPage.value = null;
        }
        return true;
      } else {
        errorCode.value = response.code;
        errorMessage.value = handleApiError(response);
        return false;
      }
    } catch {
      errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
      errorMessage.value = handleApiError({
        success: false,
        code: errorCode.value,
      });
      return false;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 清空错误状态
   */
  const clearError = () => {
    errorCode.value = null;
    errorMessage.value = null;
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
});
