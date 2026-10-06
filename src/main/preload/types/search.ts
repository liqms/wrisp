
import type { ApiResponse } from "@/shared/types";
import type { SearchResult } from "@/shared/types";

export interface SearchAPI {
  search(keyword: string, limit?: number): Promise<ApiResponse<SearchResult[]>>;
  /** 预热本地语义搜索模型（嵌入 + 重排序），用于把冷启动挪出搜索关键路径 */
  warmup(): Promise<ApiResponse<null>>;
}
