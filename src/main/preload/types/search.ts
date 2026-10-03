// AI生成
import type { ApiResponse } from "@/shared/types";
import type { SearchResult } from "@/shared/types";

export interface SearchAPI {
  search(keyword: string, limit?: number): Promise<ApiResponse<SearchResult[]>>;
}
