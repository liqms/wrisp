import { thinkService } from "@/main/core/services/think.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
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
    const result = thinkService.paginateConcepts(params);
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
    const concept = thinkService.getConceptDetail(id);
    if (concept) {
      return response.success(concept);
    }
    return response.error(ErrorCode.CONCEPT_NOT_FOUND);
  } catch (error) {
    Logger.error("获取概念详情失败", { error: JSON.stringify(error), id });
    return response.error(ErrorCode.CONCEPT_GET_FAILED, error as Error);
  }
}

// ==================== 主题 ====================

async function paginateTopics(params: {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: "ASC" | "DESC";
  conditions?: Record<string, unknown>;
}): Promise<ApiResponse<PaginationResult<Topic>>> {
  try {
    const result = thinkService.paginateTopics(params);
    return response.success(result);
  } catch (error) {
    Logger.error("分页查询主题失败", { error: JSON.stringify(error), params });
    return response.error(ErrorCode.TOPIC_LIST_FAILED, error as Error);
  }
}

async function getTopicDetail(
  id: string,
): Promise<ApiResponse<TopicWithConceptsAndBlocks | null>> {
  try {
    const topic = thinkService.getTopicDetail(id);
    if (topic) {
      return response.success(topic);
    }
    return response.error(ErrorCode.TOPIC_NOT_FOUND);
  } catch (error) {
    Logger.error("获取主题详情失败", { error: JSON.stringify(error), id });
    return response.error(ErrorCode.TOPIC_GET_FAILED, error as Error);
  }
}

// ==================== 反思 ====================

async function paginateReflections(params: {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: "ASC" | "DESC";
  conditions?: Record<string, unknown>;
}): Promise<ApiResponse<PaginationResult<Reflection>>> {
  try {
    const result = thinkService.paginateReflections(params);
    return response.success(result);
  } catch (error) {
    Logger.error("分页查询反思失败", { error: JSON.stringify(error), params });
    return response.error(ErrorCode.REFLECTION_LIST_FAILED, error as Error);
  }
}

async function getReflectionDetail(
  id: string,
): Promise<ApiResponse<ReflectionWithBlocks | null>> {
  try {
    const reflection = thinkService.getReflectionDetail(id);
    if (reflection) {
      return response.success(reflection);
    }
    return response.error(ErrorCode.REFLECTION_NOT_FOUND);
  } catch (error) {
    Logger.error("获取反思详情失败", { error: JSON.stringify(error), id });
    return response.error(ErrorCode.REFLECTION_GET_FAILED, error as Error);
  }
}

// ==================== 时间事件 ====================

async function getTemporalEvents(
  startDate?: string,
  endDate?: string,
): Promise<ApiResponse<TemporalEventWithBlock[]>> {
  try {
    const events = thinkService.getTemporalEvents(startDate, endDate);
    return response.success(events);
  } catch (error) {
    Logger.error("查询时间事件失败", { error: JSON.stringify(error), startDate, endDate });
    return response.error(ErrorCode.TEMPORAL_EVENT_LIST_FAILED, error as Error);
  }
}

export {
  paginateConcepts,
  getConceptDetail,
  paginateTopics,
  getTopicDetail,
  paginateReflections,
  getReflectionDetail,
  getTemporalEvents,
};