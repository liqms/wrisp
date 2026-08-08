import type { ApiResponse } from "@/shared/types";
import type {
  Reflection,
  ReflectionWithBlocks,
} from "@/main/types/db";
import type { PaginationResult } from "@/shared/utils/pagination";

export interface ReflectionAPI {
  reflection: {
    list(params: {
      page?: number;
      pageSize?: number;
      orderBy?: string;
      orderDir?: "ASC" | "DESC";
      conditions?: Record<string, unknown>;
    }): Promise<ApiResponse<PaginationResult<Reflection>>>;
    detail(id: string): Promise<ApiResponse<ReflectionWithBlocks | null>>;
  };
}