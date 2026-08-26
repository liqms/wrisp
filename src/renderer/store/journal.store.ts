import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  JournalFileInfo,
  JournalFileCreate,
  JournalFileUpdate,
  Id,
  ApiResponse,
} from "@/shared/types";
import { ErrorCode } from "@/shared/enums";
import { handleApiError } from "@/renderer/utils/error.utils";

export const useJournalStore = defineStore("journal", () => {
  const recentJournals = ref<JournalFileInfo[]>([]);
  const loading = ref(false);
  const loadingMore = ref(false);
  /** 是否还有更早的日志可加载 */
  const hasMore = ref(true);
  const errorCode = ref<ErrorCode | null>(null);
  const errorMessage = ref<string | null>(null);

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
  };
});
