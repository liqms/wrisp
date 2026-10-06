
import { wikiService } from "@/main/core/services/content/wiki.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type {
  ApiResponse,
  WikiOverview,
  WikiPendingCount,
  ConceptCard,
  TopicCard,
} from "@/shared/types";
import { Logger } from "@/main/utils/logger";

async function getOverview(): Promise<ApiResponse<WikiOverview>> {
  try {
    const overview = wikiService.getOverview();
    return response.success(overview);
  } catch (error) {
    Logger.error("获取Wiki概览失败", { error: JSON.stringify(error) });
    return response.error(ErrorCode.WIKI_OVERVIEW_FAILED, error as Error);
  }
}

async function getPendingCount(): Promise<ApiResponse<WikiPendingCount>> {
  try {
    const count = wikiService.getPendingCount();
    return response.success(count);
  } catch (error) {
    Logger.error("获取待整理资源数失败", { error: JSON.stringify(error) });
    return response.error(ErrorCode.WIKI_PENDING_COUNT_FAILED, error as Error);
  }
}

async function listConceptCards(params: {
  keyword?: string;
  orderBy?: string;
  orderDir?: "ASC" | "DESC";
  page?: number;
  pageSize?: number;
}): Promise<ApiResponse<{ data: ConceptCard[]; total: number }>> {
  try {
    const result = wikiService.listConceptCards(params);
    return response.success(result);
  } catch (error) {
    Logger.error("查询概念卡片列表失败", { error: JSON.stringify(error), params });
    return response.error(ErrorCode.CONCEPT_LIST_FAILED, error as Error);
  }
}

async function listTopicCards(params: {
  keyword?: string;
  orderBy?: string;
  orderDir?: "ASC" | "DESC";
  page?: number;
  pageSize?: number;
}): Promise<ApiResponse<{ data: TopicCard[]; total: number }>> {
  try {
    const result = wikiService.listTopicCards(params);
    return response.success(result);
  } catch (error) {
    Logger.error("查询主题卡片列表失败", { error: JSON.stringify(error), params });
    return response.error(ErrorCode.TOPIC_LIST_FAILED, error as Error);
  }
}

async function updateTopic(
  id: string,
  data: { title?: string; summary?: string },
): Promise<ApiResponse<boolean>> {
  try {
    const ok = wikiService.updateTopic(id, data);
    if (ok) return response.success(true);
    return response.error(ErrorCode.TOPIC_UPDATE_FAILED);
  } catch (error) {
    Logger.error("更新主题失败", { error: JSON.stringify(error), id });
    return response.error(ErrorCode.TOPIC_UPDATE_FAILED, error as Error);
  }
}

async function deleteTopic(id: string): Promise<ApiResponse<boolean>> {
  try {
    const ok = wikiService.deleteTopic(id);
    if (ok) return response.success(true);
    return response.error(ErrorCode.TOPIC_DELETE_FAILED);
  } catch (error) {
    Logger.error("删除主题失败", { error: JSON.stringify(error), id });
    return response.error(ErrorCode.TOPIC_DELETE_FAILED, error as Error);
  }
}

export {
  getOverview,
  getPendingCount,
  listConceptCards,
  listTopicCards,
  updateTopic,
  deleteTopic,
};
