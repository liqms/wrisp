import { ipcRenderer } from "electron";
import type { SearchAPI } from "../types/search";
import type { ApiResponse } from "@/shared/types";

export const searchModule: SearchAPI = {
  search: (keyword: string, limit?: number) =>
    ipcRenderer.invoke("search:search", keyword, limit) as Promise<ApiResponse<unknown[]>>,
};