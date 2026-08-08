import { ipcMain } from "electron";
import { search } from "@/main/core/apis/search.api";
import type { ApiResponse } from "@/shared/types";

export function registerSearchHandlers(): void {
  ipcMain.handle(
    "search:search",
    async (_event, keyword: string, limit?: number): Promise<ApiResponse<any[]>> => {
      return search(keyword, limit);
    },
  );
}