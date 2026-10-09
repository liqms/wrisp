import { computed } from "vue";
import { useJournalStore } from "@/renderer/store/journal.store";
import type {
  JournalEntryCreatePayload,
  JournalEntryUpdatePayload,
  JournalImportResult,
  Id,
} from "@/shared/types";
import { logger } from "@/renderer/utils/logger.utils";

interface UseJournalOptions {
  /** 挂载即加载最近若干天的条目时间线 */
  autoLoadRecent?: boolean;
  /** 自动加载的窗口天数，缺省沿用 store 默认窗口 */
  firstWindow?: number;
}

export function useJournal(options: UseJournalOptions = {}) {
  const { autoLoadRecent = false, firstWindow } = options;
  const store = useJournalStore();

  const errorCode = computed(() => store.errorCode);
  const errorMessage = computed(() => store.errorMessage);
  const hasError = computed(() => store.hasError);

  // ───── 条目化时间线（journal_entries 为唯一真源） ─────
  const days = computed(() => store.days);
  const daysLoading = computed(() => store.daysLoading);
  const loadingMoreDays = computed(() => store.loadingMoreDays);
  const hasMoreDays = computed(() => store.hasMoreDays);

  /**
   * 重置日志条目（channel 名沿用旧的 `resetJournalTable`）：
   * 设置页「重建索引」与项目表重置并行调用，返回清除的条目数
   */
  const resetJournalTable = async (): Promise<number> => {
    try {
      const count = await store.resetJournalTable();
      logger.info("日志条目重置完成", { count });
      return count;
    } catch (error) {
      logger.error("重置日志条目失败", { error });
      return 0;
    }
  };

  const clearError = () => store.clearError();

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
    void loadRecentDays(firstWindow);
  }

  return {
    errorCode,
    errorMessage,
    hasError,
    resetJournalTable,
    clearError,
    // ───── 条目化时间线 ─────
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
