import { computed } from "vue";
import { useCaptureStore } from "@/renderer/store/capture.store";
import type {
  CaptureCreate,
  CaptureUpdate,
  CaptureQuery,
  Id,
} from "@/shared/types";
import { SearchType } from "@/shared/enums";
import { logger } from "@/renderer/utils/logger.utils";

interface UseCaptureOptions {
  autoLoadRecent?: boolean;
  recentLimit?: number;
}

export function useCapture(options: UseCaptureOptions = {}) {
  const { autoLoadRecent = false, recentLimit = 50 } = options;
  const store = useCaptureStore();


  const captures = computed(() => store.captures);
  const recentCaptures = computed(() => store.recentCaptures);
  const searchResults = computed(() => store.searchResults);
  const dateRangeCaptures = computed(() => store.dateRangeCaptures);
  const loading = computed(() => store.loading);
  const errorCode = computed(() => store.errorCode);
  const errorMessage = computed(() => store.errorMessage);
  const pagination = computed(() => store.pagination);
  const hasError = computed(() => store.hasError);
  const isReady = computed(() => store.isReady);

  const createCapture = async (
    record: CaptureCreate,
  ): Promise<string | null> => {
    try {
      const id = await store.createCapture(record);
      if (id) {
        logger.info("记录创建成功", { id, content: record.content });
      }
      return id;
    } catch (error) {
      logger.error("创建记录失败", { error, record });
      return null;
    }
  };

  const updateCapture = async (record: CaptureUpdate): Promise<boolean> => {
    try {
      const success = await store.updateCapture(record);
      if (success) {
        logger.info("记录更新成功", { id: record.id });
      }
      return success;
    } catch (error) {
      logger.error("更新记录失败", { error, record });
      return false;
    }
  };

  const getRecentCaptures = async (limit?: number): Promise<void> => {
    try {
      await store.getRecentCaptures(limit);
      logger.info("获取最近记录成功", { count: recentCaptures.value.length });
    } catch (error) {
      logger.error("获取最近记录失败", { error });
    }
  };

  const deleteCapture = async (id: Id): Promise<boolean> => {
    try {
      const success = await store.deleteCapture(id);
      if (success) {
        logger.info("记录删除成功", { id });
      }
      return success;
    } catch (error) {
      logger.error("删除记录失败", { error, id });
      return false;
    }
  };

  const searchCaptures = async (
    keyword: string,
    limit?: number,
    searchType?: SearchType,
    parent_record_id?: Id | null,
  ): Promise<void> => {
    try {
      await store.searchCaptures(keyword, limit, searchType, parent_record_id);
      logger.info("搜索记录成功", {
        keyword,
        count: searchResults.value.length,
      });
    } catch (error) {
      logger.error("搜索记录失败", { error, keyword });
    }
  };

  const listCaptures = async (query?: CaptureQuery): Promise<void> => {
    try {
      await store.listCaptures(query);
      logger.info("分页查询记录成功", {
        count: captures.value.length,
        page: pagination.value?.page,
      });
    } catch (error) {
      logger.error("分页查询记录失败", { error, query });
    }
  };

  const getCapturesByDateRange = async (
    startDate: string,
    endDate: string,
  ): Promise<void> => {
    try {
      await store.getCapturesByDateRange(startDate, endDate);
      logger.info("按日期范围查询记录成功", {
        startDate,
        endDate,
        count: dateRangeCaptures.value.length,
      });
    } catch (error) {
      logger.error("按日期范围查询记录失败", { error, startDate, endDate });
    }
  };

  const loadRecentRecords = () => getRecentCaptures(recentLimit);

  const clearError = () => store.clearError();
  const clearCaptures = () => store.clearCaptures();

  if (autoLoadRecent) {
    loadRecentRecords();
  }

  return {
    captures,
    recentCaptures,
    searchResults,
    dateRangeCaptures,
    loading,
    errorCode,
    errorMessage,
    pagination,
    hasError,
    isReady,
    createCapture,
    updateCapture,
    getRecentCaptures,
    deleteCapture,
    searchCaptures,
    listCaptures,
    getCapturesByDateRange,
    loadRecentRecords,
    clearError,
    clearCaptures,
  };
}
