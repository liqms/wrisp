
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

  /**
   * 预热本地搜索模型（嵌入 + 重排序）。
   * 打开搜索框时提前调用，把数秒冷启动挪出搜索关键路径；失败静默，不影响搜索。
   */
  const warmup = (): void => {
    window.electronAPI.search.warmup().catch(() => {
      // 预热失败不影响搜索（后续搜索会自动降级/懒加载）
    });
  };

  const clear = (): void => {
    results.value = [];
    error.value = null;
    loading.value = false;
  };

  return {
    search,
    warmup,
    clear,
    results,
    loading,
    error,
  };
}
