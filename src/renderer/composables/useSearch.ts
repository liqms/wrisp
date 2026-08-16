import { ref } from "vue";
import type { JournalFileInfo } from "@/shared/types";

export function useSearch() {
  const results = ref<JournalFileInfo[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const search = async (_keyword: string): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
      // 搜索功能待实现
      results.value = [];
    } catch (e) {
      error.value = e instanceof Error ? e.message : "搜索异常";
    } finally {
      loading.value = false;
    }
  };

  return {
    search,
    results,
    loading,
    error,
  };
}
