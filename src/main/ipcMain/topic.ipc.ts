import { ipcMain } from "electron";
import {
  paginateTopics,
  getTopicDetail,
} from "@/main/core/apis/topic.api";
import type { ApiResponse } from "@/shared/types";
import type {
  Topic,
  TopicWithConceptsAndBlocks,
} from "@/main/types/db";
import type { PaginationResult } from "@/shared/utils/pagination";

export function registerTopicHandlers() {
  // 主题
  ipcMain.handle(
    "topic:list",
    async (_, params: {
      page?: number;
      pageSize?: number;
      orderBy?: string;
      orderDir?: "ASC" | "DESC";
      conditions?: Record<string, unknown>;
    }): Promise<ApiResponse<PaginationResult<Topic>>> => {
      return paginateTopics(params);
    },
  );

  ipcMain.handle(
    "topic:detail",
    async (_, id: string): Promise<ApiResponse<TopicWithConceptsAndBlocks | null>> => {
      return getTopicDetail(id);
    },
  );
}