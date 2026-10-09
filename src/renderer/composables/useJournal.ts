import { computed } from "vue";
import { useJournalStore } from "@/renderer/store/journal.store";
import type {
  JournalFileCreate,
  JournalFileUpdate,
  JournalEntryCreatePayload,
  JournalEntryUpdatePayload,
  JournalImportResult,
  Id,
} from "@/shared/types";
import { logger } from "@/renderer/utils/logger.utils";

interface UseJournalOptions {
  autoLoadRecent?: boolean;
  recentDays?: number;
}

export function useJournal(options: UseJournalOptions = {}) {
  const { autoLoadRecent = false, recentDays: recentDaysOption = 3 } = options;
  const store = useJournalStore();

  const recentJournals = computed(() => store.recentJournals);
  const loading = computed(() => store.loading);
  const loadingMore = computed(() => store.loadingMore);
  const hasMore = computed(() => store.hasMore);
  const errorCode = computed(() => store.errorCode);
  const errorMessage = computed(() => store.errorMessage);
  const hasError = computed(() => store.hasError);
  const isReady = computed(() => store.isReady);

  // ───── 条目化时间线（additive；旧整篇透出保留至 Task 10） ─────
  const days = computed(() => store.days);
  const daysLoading = computed(() => store.daysLoading);
  const loadingMoreDays = computed(() => store.loadingMoreDays);
  const hasMoreDays = computed(() => store.hasMoreDays);

  const createJournal = async (
    record: JournalFileCreate,
  ): Promise<string | null> => {
    try {
      const id = await store.createJournal(record);
      if (id) {
        logger.info("日志创建成功", { id });
      }
      return id;
    } catch (error) {
      logger.error("创建日志失败", { error, record });
      return null;
    }
  };

  const updateJournal = async (
    record: JournalFileUpdate,
  ): Promise<boolean> => {
    try {
      const success = await store.updateJournal(record);
      if (success) {
        logger.info("日志更新成功", { id: record.id });
      }
      return success;
    } catch (error) {
      logger.error("更新日志失败", { error, record });
      return false;
    }
  };

  const getRecentDays = async (limit?: number): Promise<void> => {
    try {
      await store.getRecentDays(limit);
      logger.info("获取最近日志成功", { count: recentJournals.value.length });
    } catch (error) {
      logger.error("获取最近日志失败", { error });
    }
  };

  const loadMore = async (days: number): Promise<boolean> => {
    try {
      return await store.loadMore(days);
    } catch (error) {
      logger.error("加载更多日志失败", { error });
      return false;
    }
  };

  const deleteJournal = async (id: Id): Promise<boolean> => {
    try {
      const success = await store.deleteJournal(id);
      if (success) {
        logger.info("日志删除成功", { id });
      }
      return success;
    } catch (error) {
      logger.error("删除日志失败", { error, id });
      return false;
    }
  };

  const checkTodayJournalExists = async (date?: string): Promise<boolean> => {
    try {
      return await store.checkTodayJournalExists(date);
    } catch (error) {
      logger.error("检查当日日志是否存在失败", { error, date });
      return false;
    }
  };

  const syncLocalFiles = async (): Promise<number> => {
    try {
      const count = await store.syncLocalFiles();
      if (count > 0) {
        logger.info("本地日志文件同步完成", { count });
      }
      return count;
    } catch (error) {
      logger.error("同步本地日志文件失败", { error });
      return 0;
    }
  };

  const resetJournalTable = async (): Promise<number> => {
    try {
      const count = await store.resetJournalTable();
      logger.info("file_index 表重置完成", { count });
      return count;
    } catch (error) {
      logger.error("重置 file_index 表失败", { error });
      return 0;
    }
  };

  const loadRecentRecords = () => getRecentDays(recentDaysOption);

  const updateContentLocally = (id: Id, content: string) =>
    store.updateContentLocally(id, content);

  const clearError = () => store.clearError();
  const clearJournals = () => store.clearJournals();

  // ───── 条目化时间线动作 ─────

  const loadRecentDays = async (windowSize?: number): Promise<void> => {
    try {
      await store.loadRecentDays(windowSize);
      logger.info("获取最近日志条目时间线成功", { count: days.value.length });
    } catch (error) {
      logger.error("获取最近日志条目时间线失败", { error, windowSize });
    }
  };

  const loadMoreDays = async (): Promise<boolean> => {
    try {
      const added = await store.loadMoreDays();
      logger.info("加载更多日志条目时间线完成", { added, count: days.value.length });
      return added;
    } catch (error) {
      logger.error("加载更多日志条目时间线失败", { error });
      return false;
    }
  };

  const appendEntry = async (
    record: JournalEntryCreatePayload,
  ): Promise<string | null> => {
    try {
      const id = await store.appendEntry(record);
      if (id) {
        logger.info("日志条目追加成功", { id });
      }
      return id;
    } catch (error) {
      logger.error("追加日志条目失败", { error, record });
      return null;
    }
  };

  const updateEntry = async (
    record: JournalEntryUpdatePayload,
  ): Promise<boolean> => {
    try {
      const success = await store.updateEntry(record);
      if (success) {
        logger.info("日志条目更新成功", { id: record.id });
      }
      return success;
    } catch (error) {
      logger.error("更新日志条目失败", { error, record });
      return false;
    }
  };

  const deleteEntryLocal = (id: Id): void => store.deleteEntryLocal(id);

  const requestDeleteEntry = async (id: Id): Promise<boolean> => {
    try {
      const success = await store.requestDeleteEntry(id);
      if (success) {
        logger.info("日志条目删除成功", { id });
      }
      return success;
    } catch (error) {
      logger.error("删除日志条目失败", { error, id });
      return false;
    }
  };

  const requestImportDayFile = async (
    date: string,
    overwrite?: boolean,
  ): Promise<JournalImportResult | null> => {
    try {
      const result = await store.requestImportDayFile(date, overwrite);
      if (result) {
        logger.info("当日日志文件导入完成", { date, ...result });
      }
      return result;
    } catch (error) {
      logger.error("导入当日日志文件失败", { error, date, overwrite });
      return null;
    }
  };

  const clearDays = () => store.clearDays();

  if (autoLoadRecent) {
    loadRecentRecords();
  }

  return {
    recentJournals,
    loading,
    loadingMore,
    hasMore,
    errorCode,
    errorMessage,
    hasError,
    isReady,
    createJournal,
    updateJournal,
    getRecentDays,
    loadMore,
    deleteJournal,
    checkTodayJournalExists,
    syncLocalFiles,
    resetJournalTable,
    loadRecentRecords,
    updateContentLocally,
    clearError,
    clearJournals,
    // ───── 条目化时间线（additive） ─────
    days,
    daysLoading,
    loadingMoreDays,
    hasMoreDays,
    loadRecentDays,
    loadMoreDays,
    appendEntry,
    updateEntry,
    deleteEntryLocal,
    requestDeleteEntry,
    requestImportDayFile,
    clearDays,
  };
}
