import { ipcMain } from "electron";
import {
  getDetailById,
  findTags,
  getAllTags,
  paginateTags,
  createTags,
  updateTag,
  deleteTag,
} from "@/main/core/apis/tag.api";
import type {
  Tag,
  TagCreate,
  TagUpdate,
  TagQuery,
  TagDetail,
  TagId,
  ApiResponse,
} from "@/shared/types";

export function registerTagHandlers(): void {
  ipcMain.handle(
    "tag:getDetail",
    async (_, id: TagId): Promise<ApiResponse<TagDetail | null>> => {
      return getDetailById(id);
    },
  );

  ipcMain.handle(
    "tag:find",
    async (
      _,
      name: string,
      options?: { exact?: boolean; limit?: number },
    ): Promise<ApiResponse<Tag[]>> => {
      return findTags(name, options);
    },
  );

  ipcMain.handle(
    "tag:getAll",
    async (_, entityType?: string): Promise<ApiResponse<TagDetail[]>> => {
      return getAllTags(entityType);
    },
  );

  ipcMain.handle(
    "tag:paginate",
    async (
      _,
      params: {
        page?: number;
        pageSize?: number;
        orderBy?: string;
        orderDir?: "ASC" | "DESC";
        conditions?: TagQuery;
      },
    ): Promise<ApiResponse<unknown>> => {
      return paginateTags(params);
    },
  );

  ipcMain.handle(
    "tag:create",
    async (
      _,
      data: TagCreate | TagCreate[],
    ): Promise<ApiResponse<string | string[]>> => {
      return createTags(data);
    },
  );

  ipcMain.handle(
    "tag:update",
    async (
      _,
      items:
        | { id: TagId; data: TagUpdate }
        | { id: TagId; data: TagUpdate }[],
    ): Promise<ApiResponse<number | number[]>> => {
      return updateTag(items);
    },
  );

  ipcMain.handle(
    "tag:delete",
    async (_, ids: TagId | TagId[]): Promise<ApiResponse<number>> => {
      return deleteTag(ids);
    },
  );
}