import type { ApiResponse } from "@/shared/types";
import type {
  Topic,
  TopicWithConceptsAndBlocks,
} from "@/main/types/db";
import type { PaginationResult } from "@/shared/utils/pagination";

export interface TopicAPI {
  topic: {
    list(params: {
      page?: number;
      pageSize?: number;
      orderBy?: string;
      orderDir?: "ASC" | "DESC";
      conditions?: Record<string, unknown>;
    }): Promise<ApiResponse<PaginationResult<Topic>>>;
    detail(id: string): Promise<ApiResponse<TopicWithConceptsAndBlocks | null>>;
  };
}