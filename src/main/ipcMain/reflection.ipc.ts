import { ipcMain } from "electron";
import {
  paginateReflections,
  getReflectionDetail,
} from "@/main/core/apis/reflection.api";
import type { ApiResponse } from "@/shared/types";
import type {
  Reflection,
  ReflectionWithBlocks,
} from "@/main/types/db";
import type { PaginationResult } from "@/shared/utils/pagination";

export function registerReflectionHandlers() {
  // 反思
  ipcMain.handle(
    "reflection:list",
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
    "reflection:detail",
    async (_, id: string): Promise<ApiResponse<ReflectionWithBlocks | null>> => {
      return getReflectionDetail(id);
    },
  );
}