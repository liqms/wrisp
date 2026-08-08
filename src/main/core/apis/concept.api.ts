import { conceptService } from "@/main/core/services/concept.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type { ApiResponse } from "@/shared/types";
import type {
  Concept,
  ConceptWithBlocks,
  TemporalEventWithBlock,
} from "@/main/types/db";
import type { PaginationResult } from "@/shared/utils/pagination";
import { Logger } from "@/main/utils/logger";

// ==================== 概念 ====================

async function paginateConcepts(params: {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: "ASC" | "DESC";
  conditions?: Record<string, unknown>;
}): Promise<ApiResponse<PaginationResult<Concept>>> {
  try {
    const result = conceptService.paginateConcepts(params);
    return response.success(result);
  } catch (error) {
    Logger.error("分页查询概念失败", { error: JSON.stringify(error), params });
    return response.error(ErrorCode.CONCEPT_LIST_FAILED, error as Error);
  }
}

async function getConceptDetail(
  id: string,
): Promise<ApiResponse<ConceptWithBlocks | null>> {
  try {
    const concept = conceptService.getConceptDetail(id);
    if (concept) {
      return response.success(concept);
    }
    return response.error(ErrorCode.CONCEPT_NOT_FOUND);
  } catch (error) {
    Logger.error("获取概念详情失败", { error: JSON.stringify(error), id });
    return response.error(ErrorCode.CONCEPT_GET_FAILED, error as Error);
  }
}

// ==================== 时间事件 ====================

async function getTemporalEvents(
  startDate?: string,
  endDate?: string,
): Promise<ApiResponse<TemporalEventWithBlock[]>> {
  try {
    const events = conceptService.getTemporalEvents(startDate, endDate);
    return response.success(events);
  } catch (error) {
    Logger.error("查询时间事件失败", { error: JSON.stringify(error), startDate, endDate });
    return response.error(ErrorCode.TEMPORAL_EVENT_LIST_FAILED, error as Error);
  }
}

export {
  paginateConcepts,
  getConceptDetail,
  getTemporalEvents,
};