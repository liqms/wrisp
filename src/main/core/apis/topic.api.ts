import { topicService } from "@/main/core/services/topic.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type { ApiResponse } from "@/shared/types";
import type {
  Topic,
  TopicWithConceptsAndBlocks,
} from "@/main/types/db";
import type { PaginationResult } from "@/shared/utils/pagination";
import { Logger } from "@/main/utils/logger";

// ==================== 主题 ====================

async function paginateTopics(params: {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: "ASC" | "DESC";
  conditions?: Record<string, unknown>;
}): Promise<ApiResponse<PaginationResult<Topic>>> {
  try {
    const result = topicService.paginateTopics(params);
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
    const topic = topicService.getTopicDetail(id);
    if (topic) {
      return response.success(topic);
    }
    return response.error(ErrorCode.TOPIC_NOT_FOUND);
  } catch (error) {
    Logger.error("获取主题详情失败", { error: JSON.stringify(error), id });
    return response.error(ErrorCode.TOPIC_GET_FAILED, error as Error);
  }
}

export {
  paginateTopics,
  getTopicDetail,
};