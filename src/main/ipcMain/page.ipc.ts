import { ipcMain } from "electron";
import {
  getPage,
  paginatePages,
  getPageTree,
  createPage,
  updatePage,
  deletePage,
} from "@/main/core/apis/page.api";
import type { ApiResponse } from "@/shared/types";
import type {
  Page,
  PageCreate,
  PageUpdate,
  PageQuery,
  PageTree,
} from "@/main/types/db";
import type { PaginationResult } from "@/shared/utils/pagination";

export function registerPageHandlers() {
  ipcMain.handle(
    "page:get",
    async (_, id: string): Promise<ApiResponse<Page | null>> => {
      return getPage(id);
    },
  );

  ipcMain.handle(
    "page:paginate",
    async (
      _,
      params: {
        page?: number;
        pageSize?: number;
        orderBy?: string;
        orderDir?: "ASC" | "DESC";
        conditions?: PageQuery;
      },
    ): Promise<ApiResponse<PaginationResult<Page>>> => {
      return paginatePages(params);
    },
  );

  ipcMain.handle(
    "page:getTree",
    async (_, projectId: string): Promise<ApiResponse<PageTree[]>> => {
      return getPageTree(projectId);
    },
  );

  ipcMain.handle(
    "page:create",
    async (_, data: PageCreate): Promise<ApiResponse<string>> => {
      return createPage(data);
    },
  );

  ipcMain.handle(
    "page:update",
    async (
      _,
      id: string,
      data: PageUpdate,
    ): Promise<ApiResponse<number>> => {
      return updatePage(id, data);
    },
  );

  ipcMain.handle(
    "page:delete",
    async (_, id: string): Promise<ApiResponse<number>> => {
      return deletePage(id);
    },
  );
}
