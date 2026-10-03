// AI生成
import { ref } from "vue";
import type { SearchResult } from "@/shared/types";

export function useSearch() {
  const results = ref<SearchResult[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const search = async (keyword: string): Promise<void> => {
    if (!keyword || keyword.trim() === "") {
      results.value = [];
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const res = await window.electronAPI.search.search(keyword, 20);
      if (res.success) {
        results.value = (res.data ?? []) as SearchResult[];
      } else {
        results.value = [];
        error.value = res.error?.type ?? "搜索失败";
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : "搜索异常";
      results.value = [];
    } finally {
      loading.value = false;
    }
  };

  const clear = (): void => {
    results.value = [];
    error.value = null;
    loading.value = false;
  };

  return {
    search,
    clear,
    results,
    loading,
    error,
  };
}
