import { ipcMain } from "electron";
import {
  paginateConcepts,
  getConceptDetail,
  getTemporalEvents,
} from "@/main/core/apis/concept.api";
import type { ApiResponse } from "@/shared/types";
import type {
  Concept,
  ConceptWithBlocks,
  TemporalEventWithBlock,
} from "@/main/types/db";
import type { PaginationResult } from "@/shared/utils/pagination";

export function registerConceptHandlers() {
  // 概念
  ipcMain.handle(
    "concept:list",
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
    "concept:detail",
    async (_, id: string): Promise<ApiResponse<ConceptWithBlocks | null>> => {
      return getConceptDetail(id);
    },
  );

  // 时间事件（从 temporal 移入 concept 域）
  ipcMain.handle(
    "concept:temporal:list",
    async (_, startDate?: string, endDate?: string): Promise<ApiResponse<TemporalEventWithBlock[]>> => {
      return getTemporalEvents(startDate, endDate);
    },
  );
}