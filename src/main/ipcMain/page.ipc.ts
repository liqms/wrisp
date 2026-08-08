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
import type { Page, PageTree } from "@/main/types/db";
import type { CreatePageInput, UpdatePageInput, PageQuery } from "@/shared/types/page.types";
import type { PaginationResult } from "@/shared/utils/pagination";
import type { PageType } from "@/shared/enums";

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
    async (_, projectId: string, pageType: PageType): Promise<ApiResponse<PageTree[]>> => {
      return getPageTree(projectId, pageType);
    },
  );

  ipcMain.handle(
    "page:create",
    async (_, data: CreatePageInput): Promise<ApiResponse<string>> => {
      return createPage(data);
    },
  );

  ipcMain.handle(
    "page:update",
    async (
      _,
      data: UpdatePageInput,
    ): Promise<ApiResponse<number>> => {
      return updatePage(data);
    },
  );

  ipcMain.handle(
    "page:delete",
    async (_, id: string): Promise<ApiResponse<number>> => {
      return deletePage(id);
    },
  );
}
