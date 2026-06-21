import { ipcMain } from "electron";
import {
  paginateConcepts,
  getConceptDetail,
  paginateTopics,
  getTopicDetail,
  paginateReflections,
  getReflectionDetail,
  getTemporalEvents,
} from "@/main/core/apis/think.api";
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

export function registerThinkHandlers() {
  // 概念
  ipcMain.handle(
    "think:concept:list",
    async (_, params: {
      page?: number;
      pageSize?: number;
      orderBy?: string;
      orderDir?: "ASC" | "DESC";
      conditions?: Record<string, unknown>;
    }): Promise<ApiResponse<PaginationResult<Concept>>> => {
      return paginateConcepts(params);
    },
  );

  ipcMain.handle(
    "think:concept:detail",
    async (_, id: string): Promise<ApiResponse<ConceptWithBlocks | null>> => {
      return getConceptDetail(id);
    },
  );

  // 主题
  ipcMain.handle(
    "think:topic:list",
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
    "think:topic:detail",
    async (_, id: string): Promise<ApiResponse<TopicWithConceptsAndBlocks | null>> => {
      return getTopicDetail(id);
    },
  );

  // 反思
  ipcMain.handle(
    "think:reflection:list",
    async (_, params: {
      page?: number;
      pageSize?: number;
      orderBy?: string;
      orderDir?: "ASC" | "DESC";
      conditions?: Record<string, unknown>;
    }): Promise<ApiResponse<PaginationResult<Reflection>>> => {
      return paginateReflections(params);
    },
  );

  ipcMain.handle(
    "think:reflection:detail",
    async (_, id: string): Promise<ApiResponse<ReflectionWithBlocks | null>> => {
      return getReflectionDetail(id);
    },
  );

  // 时间事件
  ipcMain.handle(
    "think:temporal:list",
    async (_, startDate?: string, endDate?: string): Promise<ApiResponse<TemporalEventWithBlock[]>> => {
      return getTemporalEvents(startDate, endDate);
    },
  );
}