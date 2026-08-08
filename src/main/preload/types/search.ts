import type { ApiResponse } from "@/shared/types";

export interface SearchAPI {
  search(keyword: string, limit?: number): Promise<ApiResponse<any[]>>;
}