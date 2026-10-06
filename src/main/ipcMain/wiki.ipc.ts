
import { ipcMain } from "electron";
import {
  getOverview,
  getPendingCount,
  listConceptCards,
  listTopicCards,
  updateTopic,
  deleteTopic,
} from "@/main/core/apis/wiki.api";
import type {
  ApiResponse,
  WikiOverview,
  WikiPendingCount,
  ConceptCard,
  TopicCard,
} from "@/shared/types";

export function registerWikiHandlers() {
  ipcMain.handle(
    "wiki:overview",
    async (): Promise<ApiResponse<WikiOverview>> => {
      return getOverview();
    },
  );

  ipcMain.handle(
    "wiki:pendingCount",
    async (): Promise<ApiResponse<WikiPendingCount>> => {
      return getPendingCount();
    },
  );

  ipcMain.handle(
    "wiki:conceptCards",
    async (
      _,
      params: {
        keyword?: string;
        orderBy?: string;
        orderDir?: "ASC" | "DESC";
        page?: number;
        pageSize?: number;
      },
    ): Promise<ApiResponse<{ data: ConceptCard[]; total: number }>> => {
      return listConceptCards(params);
    },
  );

  ipcMain.handle(
    "wiki:topicCards",
    async (
      _,
      params: {
        keyword?: string;
        orderBy?: string;
        orderDir?: "ASC" | "DESC";
        page?: number;
        pageSize?: number;
      },
    ): Promise<ApiResponse<{ data: TopicCard[]; total: number }>> => {
      return listTopicCards(params);
    },
  );

  ipcMain.handle(
    "topic:update",
    async (
      _,
      id: string,
      data: { title?: string; summary?: string },
    ): Promise<ApiResponse<boolean>> => {
      return updateTopic(id, data);
    },
  );

  ipcMain.handle(
    "topic:delete",
    async (_, id: string): Promise<ApiResponse<boolean>> => {
      return deleteTopic(id);
    },
  );
}
