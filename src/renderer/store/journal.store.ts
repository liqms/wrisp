import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  JournalFileInfo,
  JournalFileCreate,
  JournalFileUpdate,
  JournalEntryCreatePayload,
  JournalEntryUpdatePayload,
  JournalDayView,
  JournalImportResult,
  Id,
  ApiResponse,
} from "@/shared/types";
import { ErrorCode } from "@/shared/enums";
import { handleApiError } from "@/renderer/utils/error.utils";

/** 条目化时间线默认窗口天数（首屏 / 翻页 / 动作后刷新共用） */
const DAY_WINDOW_SIZE = 5;

/** 按日期倒序（新 → 旧）返回新数组，与 main 侧下发顺序一致 */
const sortDaysDesc = (records: JournalDayView[]): JournalDayView[] =>
  [...records].sort((a, b) => b.date.localeCompare(a.date));

/** 时间线中最早的一天，作为翻页游标；main 侧用严格 `date < cursor`，游标当日不会重复下发 */
const earliestDate = (records: JournalDayView[]): string | undefined =>
  records.reduce<string | undefined>(
    (min, record) => (min === undefined || record.date < min ? record.date : min),
    undefined,
  );

/** 时间线合并：新日期直接追加，同日期按条目 id 去重兜底（翻页窗口与本地窗口重叠时保留已有条目） */
const mergeDays = (
  current: JournalDayView[],
  incoming: JournalDayView[],
): JournalDayView[] => {
  const byDate = new Map(current.map((record) => [record.date, record]));
  for (const record of incoming) {
    const existing = byDate.get(record.date);
    if (!existing) {
      byDate.set(record.date, record);
      continue;
    }
    const knownIds = new Set(existing.entries.map((entry) => entry.id));
    const missing = record.entries.filter((entry) => !knownIds.has(entry.id));
    if (missing.length > 0) {
      byDate.set(record.date, {
        ...existing,
        has_legacy_file: existing.has_legacy_file || record.has_legacy_file,
        entries: [...existing.entries, ...missing],
      });
    }
  }
  return sortDaysDesc([...byDate.values()]);
};

export const useJournalStore = defineStore("journal", () => {
  const recentJournals = ref<JournalFileInfo[]>([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  /** 是否还有更早的日志可加载 */
  const hasMore = ref(true);
  const errorCode = ref<ErrorCode | null>(null);
  const errorMessage = ref<string | null>(null);

  // ───── 条目化时间线状态（journal_entries 为真源；上方整篇状态保留至 Task 10） ─────

  /** 最近若干天的条目时间线，按日期倒序 */
  const days = ref<JournalDayView[]>([]);
  /** 整窗刷新（首屏 / 动作后）加载中 */
  const daysLoading = ref(false);
  /** 翻页加载中（与 daysLoading 互不干涉，避免翻页时整窗闪烁） */
  const loadingMoreDays = ref(false);
  /** 是否还有更早的时间线可加载 */
  const hasMoreDays = ref(true);

  const hasError = computed(() => errorCode.value !== null);
  const isReady = computed(() => !loading.value && !hasError.value);

  const createJournal = async (
    journal: JournalFileCreate,
  ): Promise<string | null> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.journal.createJournal(
        journal,
      )) as ApiResponse<string | null>;

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

  /** 本地立即更新 store 中的日志内容（乐观更新） */
  const updateContentLocally = (id: Id, content: string) => {
    const idx = recentJournals.value.findIndex((r) => r.id === id);
    if (idx !== -1) {
      recentJournals.value[idx] = {
        ...recentJournals.value[idx],
        content,
      };
    }
  };

  /** 静默后台保存到磁盘，不阻塞 UI */
  const updateJournal = async (
    journal: JournalFileUpdate,
  ): Promise<boolean> => {
    try {
      const response = (await window.electronAPI.journal.updateJournal(
        journal,
      )) as ApiResponse<boolean>;

      if (response.success && response.data) {
        return true;
      } else {
        console.warn("后台保存日志失败", response);
        return false;
      }
    } catch (error) {
      console.warn("后台保存日志异常", error);
      return false;
    }
  };

  const getRecentDays = async (days?: number): Promise<void> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.journal.getRecentDays(
        days,
      )) as ApiResponse<JournalFileInfo[]>;

      if (response.success && response.data) {
        recentJournals.value = response.data as JournalFileInfo[];
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
   * 加载更多历史日志：按日期倒序取前 days 条，与已有记录合并去重后追加到列表末尾
   * @param days 累计加载的总天数
   * @returns 是否新增了记录
   */
  const loadMore = async (days: number): Promise<boolean> => {
    if (loadingMore.value || !hasMore.value) return false;
    loadingMore.value = true;

    try {
      const response = (await window.electronAPI.journal.getRecentDays(
        days,
      )) as ApiResponse<JournalFileInfo[]>;

      if (response.success && response.data) {
        const data = response.data as JournalFileInfo[];
        const existingIds = new Set(recentJournals.value.map((r) => r.id));
        const newRecords = data.filter((r) => !existingIds.has(r.id));
        if (newRecords.length > 0) {
          recentJournals.value = [...recentJournals.value, ...newRecords];
          return true;
        }
      }
      // 无新增记录，说明已加载全部
      hasMore.value = false;
      return false;
    } catch {
      hasMore.value = false;
      return false;
    } finally {
      loadingMore.value = false;
    }
  };

  const deleteJournal = async (id: Id): Promise<boolean> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.journal.deleteJournal(
        id,
      )) as ApiResponse<null>;

      if (response.success) {
        recentJournals.value = recentJournals.value.filter(
          (r) => r.id !== id,
        );
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

  const checkTodayJournalExists = async (date?: string): Promise<boolean> => {
    try {
      const response = (await window.electronAPI.journal.checkTodayJournalExists(
        date,
      )) as ApiResponse<boolean>;

      if (response.success && response.data !== undefined) {
        return response.data as boolean;
      }
      return false;
    } catch (error) {
      console.warn("检查当日日志是否存在失败", error);
      return false;
    }
  };

  const syncLocalFiles = async (): Promise<number> => {
    try {
      const response = (await window.electronAPI.journal.syncLocalFiles()) as ApiResponse<number>;

      if (response.success && response.data !== undefined) {
        return response.data as number;
      }
      return 0;
    } catch (error) {
      console.warn("同步本地日志文件失败", error);
      return 0;
    }
  };

  const resetJournalTable = async (): Promise<number> => {
    try {
      const response = (await window.electronAPI.journal.resetJournalTable()) as ApiResponse<number>;

      if (response.success && response.data !== undefined) {
        return response.data as number;
      }
      return 0;
    } catch (error) {
      console.warn("重置 file_index 表失败", error);
      return 0;
    }
  };

  const clearError = () => {
    errorCode.value = null;
    errorMessage.value = null;
  };

  // ───── 条目化动作（additive；旧整篇动作保留至 Task 10） ─────

  /**
   * 整窗刷新最近若干天的时间线：重置 days 与翻页状态
   * @param windowSize 窗口天数，缺省取默认窗口
   */
  const loadRecentDays = async (
    windowSize: number = DAY_WINDOW_SIZE,
  ): Promise<void> => {
    daysLoading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      // 游标显式置空：整窗刷新永远从最新一天开始
      const response = (await window.electronAPI.journal.listRecentDays(
        windowSize,
        undefined,
      )) as ApiResponse<JournalDayView[]>;

      if (response.success && response.data) {
        days.value = sortDaysDesc(response.data as JournalDayView[]);
        hasMoreDays.value = true;
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
      daysLoading.value = false;
    }
  };

  /**
   * 加载更早的时间线：以当前最早日期为游标（main 侧严格 `date < cursor`，游标当日及其后已被排除）
   * @returns 是否新增了日期；仅当页面确实没有新日期时才置 hasMoreDays=false，
   *          失败 / 异常保留可翻页标记（瞬时错误不得永久杀死无限滚动），下次滚动可重试
   */
  const loadMoreDays = async (): Promise<boolean> => {
    if (loadingMoreDays.value || !hasMoreDays.value) return false;

    // 空时间线没有翻页游标可取（earliestDate 为 undefined，会把「取最新窗」误当翻页），
    // 直接委托整窗加载
    if (days.value.length === 0) {
      await loadRecentDays();
      return days.value.length > 0;
    }

    loadingMoreDays.value = true;

    try {
      const response = (await window.electronAPI.journal.listRecentDays(
        DAY_WINDOW_SIZE,
        earliestDate(days.value),
      )) as ApiResponse<JournalDayView[]>;

      if (response.success && response.data) {
        const incoming = response.data as JournalDayView[];
        const knownDates = new Set(days.value.map((record) => record.date));
        const newDates = incoming.filter((d) => !knownDates.has(d.date));
        if (newDates.length === 0) {
          // 唯一允许关闭翻页的分支：这一页确实没有新日期（时间线到头）
          hasMoreDays.value = false;
          return false;
        }
        days.value = mergeDays(days.value, incoming);
        return true;
      }
      // 坏页：保持 hasMoreDays=true 允许重试，仅记录错误
      if (!response.success) {
        errorCode.value = response.code;
        errorMessage.value = handleApiError(response);
      }
      return false;
    } catch {
      errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
      errorMessage.value = handleApiError({
        success: false,
        code: errorCode.value,
      });
      return false;
    } finally {
      loadingMoreDays.value = false;
    }
  };

  /**
   * 追加一条日志条目并整窗刷新（条目 id / 日期由 main 侧生成，本地不伪造视图）
   * @returns 新条目 ID，失败返回 null
   */
  const appendEntry = async (
    payload: JournalEntryCreatePayload,
  ): Promise<string | null> => {
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.journal.appendEntry(
        payload,
      )) as ApiResponse<string>;

      if (response.success && response.data) {
        const id = response.data as string;
        await loadRecentDays(days.value.length || DAY_WINDOW_SIZE);
        return id;
      }
      errorCode.value = response.code;
      errorMessage.value = handleApiError(response);
      return null;
    } catch {
      errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
      errorMessage.value = handleApiError({
        success: false,
        code: errorCode.value,
      });
      return null;
    }
  };

  /**
   * 更新一条日志条目（正文 / 发生时刻）：channel 成功且确实更新了行（data=true）才整窗刷新；
   * data=false（条目不存在 / 并发下 0 行更新）是合法空操作 —— 返回 false、不记 errorCode、不重拉。
   * 仅 !success 才记录错误码。
   */
  const updateEntry = async (
    payload: JournalEntryUpdatePayload,
  ): Promise<boolean> => {
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.journal.updateEntry(
        payload,
      )) as ApiResponse<boolean>;

      if (response.success) {
        const updated = Boolean(response.data);
        if (updated) {
          await loadRecentDays(days.value.length || DAY_WINDOW_SIZE);
        }
        return updated;
      }
      errorCode.value = response.code;
      errorMessage.value = handleApiError(response);
      return false;
    } catch {
      errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
      errorMessage.value = handleApiError({
        success: false,
        code: errorCode.value,
      });
      return false;
    }
  };

  /**
   * 乐观本地删除：仅从 days 移除条目，保留当日空容器（UI 需要它承载录入 / 导入入口）
   */
  const deleteEntryLocal = (id: Id) => {
    days.value = days.value.map((record) =>
      record.entries.some((entry) => entry.id === id)
        ? { ...record, entries: record.entries.filter((entry) => entry.id !== id) }
        : record,
    );
  };

  /**
   * 请求软删除条目：channel 成功且确实删了行（data=true）才做本地移除，不重拉时间线
   * （整窗重拉会重置翻页深度，交给调用方按需刷新）。
   * data=false（条目不存在 / 并发下已被删，Task 6 刻意返回的合法空操作）——
   * 返回 false、不记 errorCode、不本地移除；仅 !success 才记录错误码。
   */
  const requestDeleteEntry = async (id: Id): Promise<boolean> => {
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.journal.deleteEntry(
        id,
      )) as ApiResponse<boolean>;

      if (response.success) {
        const deleted = Boolean(response.data);
        if (deleted) {
          deleteEntryLocal(id);
        }
        return deleted;
      }
      errorCode.value = response.code;
      errorMessage.value = handleApiError(response);
      return false;
    } catch {
      errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
      errorMessage.value = handleApiError({
        success: false,
        code: errorCode.value,
      });
      return false;
    }
  };

  /**
   * 显式导入当日旧版整篇 `.md`（拆条目），成功后整窗刷新
   * @param date 目标日期（yyyy-MM-dd）
   * @param overwrite 当日已有条目时是否仍按 id 合并
   * @returns 导入 / 更新 / 跳过计数，失败返回 null
   */
  const requestImportDayFile = async (
    date: string,
    overwrite?: boolean,
  ): Promise<JournalImportResult | null> => {
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.journal.importDayFile(
        date,
        overwrite,
      )) as ApiResponse<JournalImportResult>;

      if (response.success && response.data) {
        const result = response.data as JournalImportResult;
        await loadRecentDays(days.value.length || DAY_WINDOW_SIZE);
        return result;
      }
      errorCode.value = response.code;
      errorMessage.value = handleApiError(response);
      return null;
    } catch {
      errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
      errorMessage.value = handleApiError({
        success: false,
        code: errorCode.value,
      });
      return null;
    }
  };

  /** 清空条目时间线（切换视图 / 重置数据时用，不影响旧整篇状态） */
  const clearDays = () => {
    days.value = [];
    hasMoreDays.value = true;
  };

  const clearJournals = () => {
    recentJournals.value = [];
    hasMore.value = true;
  };

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
    updateContentLocally,
    getRecentDays,
    loadMore,
    deleteJournal,
    checkTodayJournalExists,
    syncLocalFiles,
    resetJournalTable,
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
});
