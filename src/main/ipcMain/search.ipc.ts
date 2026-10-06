
import { ipcMain } from "electron";
import { search, warmupSearch } from "@/main/core/apis/search.api";
import type { ApiResponse, SearchResult } from "@/shared/types";

export function registerSearchHandlers(): void {
  ipcMain.handle(
    "search:search",
    async (_event, keyword: string, limit?: number): Promise<ApiResponse<SearchResult[]>> => {
      return search(keyword, limit);
    },
  );

  ipcMain.handle(
    "search:warmup",
    async (): Promise<ApiResponse<null>> => {
      return warmupSearch();
    },
  );
}