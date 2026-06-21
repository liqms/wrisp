import type { ApiResponse } from "@/shared/types";
import type {
  Concept,
  ConceptWithBlocks,
  Topic,
  TopicWithConceptsAndBlocks,
  Reflection,
  ReflectionWithBlocks,
  TemporalEventWithBlock,
} from "@/main/types/db";
import type { PaginationResult } from "@/shared/utils/pagination";

export interface ThinkAPI {
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
  temporal: {
    list(startDate?: string, endDate?: string): Promise<ApiResponse<TemporalEventWithBlock[]>>;
  };
}