import { ipcRenderer } from "electron";
import type { SearchAPI } from "../types/search";

export const searchModule: SearchAPI = {
  search: (keyword: string, limit?: number) =>
    ipcRenderer.invoke("search:search", keyword, limit) as Promise<any>,
};