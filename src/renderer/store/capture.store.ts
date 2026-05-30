import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  CaptureCreate,
  CaptureUpdate,
  CaptureQuery,
  CaptureListItem,
  CaptureDateListItem,
  CaptureDetail,
  Id,
  ApiResponse,
} from "@/shared/types";
import { ErrorCode, SearchType } from "@/shared/enums";
import { handleApiError } from "@/renderer/utils/error.utils";

const sortByCreatedAtAsc = (captures: any[]) => {
  return [...captures].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
};

const sortByDateAsc = (groups: CaptureDateListItem[]) => {
  return [...groups].sort((a, b) => a.date.localeCompare(b.date));
};

export const useCaptureStore = defineStore("capture", () => {
  const captures = ref<CaptureListItem[]>([]);
  const recentCaptures = ref<CaptureListItem[]>([]);
  const searchResults = ref<CaptureListItem[]>([]);
  const dateRangeCaptures = ref<CaptureDateListItem[]>([]);
  const currentCaptureId = ref<Id | null>(null);
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

  const createCapture = async (
    capture: CaptureCreate,
  ): Promise<string | null> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.capture.createCapture(
        capture,
      )) as ApiResponse<CaptureDetail | null>;

      if (response.success && response.data) {
        const detail = response.data as CaptureDetail;
        const dateKey = detail.created_at.slice(0, 10);
        const grp = dateRangeCaptures.value.find((g) => g.date === dateKey);
        if (grp) {
          grp.captures.push(detail as any);
          grp.captures = sortByCreatedAtAsc(grp.captures);
        } else {
          dateRangeCaptures.value.push({
            date: dateKey,
            captures: [detail as any],
          });
          dateRangeCaptures.value = sortByDateAsc(dateRangeCaptures.value);
        }

        dateRangeCaptures.value = sortByDateAsc(
          dateRangeCaptures.value.map((g) => ({
            date: g.date,
            captures: sortByCreatedAtAsc([...g.captures]),
          })),
        );

        return detail.id;
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

  const updateCapture = async (capture: CaptureUpdate): Promise<boolean> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.capture.updateCapture(
        capture,
      )) as ApiResponse<CaptureDetail | null>;

      if (response.success && response.data) {
        const detail = response.data as CaptureDetail;

        captures.value = captures.value.map((r) =>
          r.id === detail.id ? (detail as any) : r,
        );
        recentCaptures.value = recentCaptures.value.map((r) =>
          r.id === detail.id ? (detail as any) : r,
        );
        searchResults.value = searchResults.value.map((r) =>
          r.id === detail.id ? (detail as any) : r,
        );

        for (const grp of dateRangeCaptures.value) {
          grp.captures = grp.captures.map((c: any) =>
            c.id === detail.id ? (detail as any) : c,
          );
        }

        dateRangeCaptures.value = sortByDateAsc(
          dateRangeCaptures.value.map((g) => ({
            date: g.date,
            captures: [...g.captures],
          })),
        );

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

  const getRecentCaptures = async (limit?: number): Promise<void> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.capture.getRecentCaptures(
        limit,
      )) as ApiResponse<CaptureListItem[]>;

      if (response.success && response.data) {
        recentCaptures.value = response.data as CaptureListItem[];
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

  const deleteCapture = async (id: Id): Promise<boolean> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.capture.deleteCapture(
        id,
      )) as ApiResponse<null>;

      if (response.success) {
        captures.value = captures.value.filter((r) => r.id !== id);
        recentCaptures.value = recentCaptures.value.filter((r) => r.id !== id);
        searchResults.value = searchResults.value.filter((r) => r.id !== id);

        for (const grp of dateRangeCaptures.value) {
          grp.captures = grp.captures.filter((c: any) => c.id !== id);
        }
        dateRangeCaptures.value = sortByDateAsc(
          dateRangeCaptures.value
            .map((g) => ({
              date: g.date,
              captures: [...g.captures],
            }))
            .filter((g) => g.captures.length > 0),
        );

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

  const searchCaptures = async (
    keyword: string,
    limit?: number,
    searchType?: SearchType,
    parent_record_id?: Id | null,
  ): Promise<void> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.capture.searchCaptures(
        keyword,
        limit,
        searchType,
        parent_record_id,
      )) as ApiResponse<CaptureListItem[]>;

      if (response.success && response.data) {
        searchResults.value = response.data as CaptureListItem[];
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

  const listCaptures = async (query?: CaptureQuery): Promise<void> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.capture.listCaptures(
        query,
      )) as ApiResponse<CaptureListItem[]>;

      if (response.success && response.data) {
        captures.value = response.data as CaptureListItem[];
        if ("pagination" in response && response.pagination) {
          pagination.value = response.pagination;
        }
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

  const getCapturesByDateRange = async (
    startDate: string,
    endDate: string,
  ): Promise<void> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.capture.getCapturesByDateRange(
        startDate,
        endDate,
      )) as ApiResponse<CaptureDateListItem[]>;

      if (response.success && response.data) {
        const data = response.data as CaptureDateListItem[];
        const newGroups = data.map((g) => ({
          date: g.date,
          captures: [...g.captures],
        }));

        const mergedMap = new Map<string, CaptureListItem[]>();

        for (const g of newGroups) {
          mergedMap.set(g.date, [...g.captures]);
        }

        for (const g of dateRangeCaptures.value) {
          const existing = mergedMap.get(g.date);
          if (!existing) {
            mergedMap.set(g.date, [...g.captures]);
          } else {
            const ids = new Set(existing.map((c) => c.id));
            for (const c of g.captures) {
              if (!ids.has(c.id)) {
                existing.push(c);
                ids.add(c.id);
              }
            }
            mergedMap.set(g.date, existing);
          }
        }

        dateRangeCaptures.value = sortByDateAsc(
          Array.from(mergedMap.entries()).map(([date, captures]) => ({
            date,
            captures: sortByCreatedAtAsc([...captures]),
          })),
        ) as unknown as CaptureDateListItem[];
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

  const clearError = () => {
    errorCode.value = null;
    errorMessage.value = null;
  };

  const clearCaptures = () => {
    captures.value = [];
    recentCaptures.value = [];
    searchResults.value = [];
    dateRangeCaptures.value = [];
    pagination.value = null;
    currentCaptureId.value = null;
  };

  return {
    captures,
    recentCaptures,
    searchResults,
    dateRangeCaptures,
    currentCaptureId,
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
    clearError,
    clearCaptures,
  };
});
