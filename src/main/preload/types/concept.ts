import type { ApiResponse } from "@/shared/types";
import type {
  Concept,
  ConceptWithBlocks,
  TemporalEventWithBlock,
} from "@/main/types/db";
import type { PaginationResult } from "@/shared/utils/pagination";

export interface ConceptAPI {
  concept: {
    list(params: {
      page?: number;
      pageSize?: number;
      orderBy?: string;
      orderDir?: "ASC" | "DESC";
      conditions?: Record<string, unknown>;
    }): Promise<ApiResponse<PaginationResult<Concept>>>;
    detail(id: string): Promise<ApiResponse<ConceptWithBlocks | null>>;
  };
  temporal: {
    list(startDate?: string, endDate?: string): Promise<ApiResponse<TemporalEventWithBlock[]>>;
  };
}