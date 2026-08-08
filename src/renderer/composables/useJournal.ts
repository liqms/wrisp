import { computed } from "vue";
import { useJournalStore } from "@/renderer/store/journal.store";
import type {
  JournalFileCreate,
  JournalFileUpdate,
  Id,
} from "@/shared/types";
import { logger } from "@/renderer/utils/logger.utils";

interface UseJournalOptions {
  autoLoadRecent?: boolean;
  recentDays?: number;
}

export function useJournal(options: UseJournalOptions = {}) {
  const { autoLoadRecent = false, recentDays: days = 3 } = options;
  const store = useJournalStore();

  const recentJournals = computed(() => store.recentJournals);
  const loading = computed(() => store.loading);
  const errorCode = computed(() => store.errorCode);
  const errorMessage = computed(() => store.errorMessage);
  const hasError = computed(() => store.hasError);
  const isReady = computed(() => store.isReady);

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

  const loadRecentRecords = () => getRecentDays(days);

  const updateContentLocally = (id: Id, content: string) =>
    store.updateContentLocally(id, content);

  const clearError = () => store.clearError();
  const clearJournals = () => store.clearJournals();

  if (autoLoadRecent) {
    loadRecentRecords();
  }

  return {
    recentJournals,
    loading,
    errorCode,
    errorMessage,
    hasError,
    isReady,
    createJournal,
    updateJournal,
    getRecentDays,
    deleteJournal,
    checkTodayJournalExists,
    syncLocalFiles,
    loadRecentRecords,
    updateContentLocally,
    clearError,
    clearJournals,
  };
}
