import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { ApiResponse } from "@/shared/types";
import type {
  Tag,
  TagCreate,
  TagUpdate,
  TagQuery,
  TagDetail,
  TagId,
} from "@/shared/types";
import type { PaginationResult } from "@/shared/utils/pagination";
import { ErrorCode } from "@/shared/enums";
import { handleApiError } from "@/renderer/utils/error.utils";

export const useTagStore = defineStore("tag", () => {
  const tags = ref<TagDetail[]>([]);
  const allTags = ref<TagDetail[]>([]);
  const currentTag = ref<TagDetail | null>(null);
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
   * 分页查询标签
   */
  const paginateTags = async (params: {
    page?: number;
    pageSize?: number;
    orderBy?: string;
    orderDir?: "ASC" | "DESC";
    conditions?: TagQuery;
  }): Promise<void> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.tag.paginateTags(
        params,
      )) as ApiResponse<PaginationResult<TagDetail>>;

      if (response.success && response.data) {
        const result = response.data as PaginationResult<TagDetail>;
        tags.value = result.data;
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
    } catch (error) {
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
   * 获取标签详情
   */
  const getTagDetail = async (id: TagId): Promise<TagDetail | null> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.tag.getDetailById(
        id,
      )) as ApiResponse<TagDetail | null>;

      if (response.success && response.data) {
        currentTag.value = response.data as TagDetail;
        return currentTag.value;
      } else {
        errorCode.value = response.code;
        errorMessage.value = handleApiError(response);
        return null;
      }
    } catch (error) {
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
   * 查询标签（模糊搜索）
   */
  const findTags = async (
    name: string,
    options?: { exact?: boolean; limit?: number },
  ): Promise<Tag[]> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.tag.findTags(
        name,
        options,
      )) as ApiResponse<Tag[]>;

      if (response.success && response.data) {
        return response.data as Tag[];
      } else {
        errorCode.value = response.code;
        errorMessage.value = handleApiError(response);
        return [];
      }
    } catch (error) {
      errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
      errorMessage.value = handleApiError({
        success: false,
        code: errorCode.value,
      });
      return [];
    } finally {
      loading.value = false;
    }
  };

  /**
   * 获取所有标签及使用次数
   */
  const getAllTags = async (entityType?: string): Promise<void> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.tag.getAllTags(
        entityType,
      )) as ApiResponse<TagDetail[]>;

      if (response.success && response.data) {
        allTags.value = response.data as TagDetail[];
      } else {
        errorCode.value = response.code;
        errorMessage.value = handleApiError(response);
      }
    } catch (error) {
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
   * 创建单个或批量标签
   */
  const createTags = async (
    data: TagCreate | TagCreate[],
  ): Promise<string | string[] | null> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.tag.createTags(
        data,
      )) as ApiResponse<string | string[]>;

      if (response.success && response.data) {
        return response.data as string | string[];
      } else {
        errorCode.value = response.code;
        errorMessage.value = handleApiError(response);
        return null;
      }
    } catch (error) {
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
   * 更新单个或批量标签
   */
  const updateTag = async (
    items:
      | { id: TagId; data: TagUpdate }
      | { id: TagId; data: TagUpdate }[],
  ): Promise<boolean> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.tag.updateTag(
        items,
      )) as ApiResponse<number | number[]>;

      if (response.success && (response.data as number) > 0 || (response.data as number[]).length > 0) {
        return true;
      } else {
        errorCode.value = response.code;
        errorMessage.value = handleApiError(response);
        return false;
      }
    } catch (error) {
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
   * 删除单个或批量标签
   */
  const deleteTag = async (ids: TagId | TagId[]): Promise<boolean> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.tag.deleteTag(
        ids,
      )) as ApiResponse<number>;

      if (response.success && (response.data as number) > 0) {
        return true;
      } else {
        errorCode.value = response.code;
        errorMessage.value = handleApiError(response);
        return false;
      }
    } catch (error) {
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

  return {
    // 状态
    tags,
    allTags,
    currentTag,
    loading,
    errorCode,
    errorMessage,
    pagination,
    // 计算属性
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
});