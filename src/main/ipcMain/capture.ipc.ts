import { ipcMain } from "electron";
import {
  createCapture,
  updateCapture,
  getRecentCaptures,
  deleteCapture,
  searchCaptures,
  listCaptures,
  getCapturesByDateRange,
} from "@/main/core/apis/capture.api";
import type {
  CaptureCreate,
  CaptureUpdate,
  CaptureQuery,
  CaptureListItem,
  CaptureDetail,
  Id,
  ApiResponse,
  CaptureDateListItem,
} from "@/shared/types";
import type { SearchType } from "@/shared/enums";

export function registerCaptureHandlers(): void {
  ipcMain.handle(
    "capture:create",
    async (
      _,
      record: CaptureCreate,
    ): Promise<ApiResponse<CaptureDetail | null>> => {
      return createCapture(record);
    },
  );

  ipcMain.handle(
    "capture:update",
    async (
      _,
      record: CaptureUpdate,
    ): Promise<ApiResponse<CaptureDetail | null>> => {
      return updateCapture(record);
    },
  );

  ipcMain.handle(
    "capture:getRecent",
    async (_, limit?: number): Promise<ApiResponse<CaptureListItem[]>> => {
      return getRecentCaptures(limit);
    },
  );

  ipcMain.handle(
    "capture:delete",
    async (_, id: Id): Promise<ApiResponse<null>> => {
      return deleteCapture(id);
    },
  );

  ipcMain.handle(
    "capture:search",
    async (
      _,
      keyword: string,
      limit?: number,
      searchType?: SearchType,
      parent_record_id?: Id | null,
    ): Promise<ApiResponse<CaptureListItem[]>> => {
      return searchCaptures(keyword, limit, searchType, parent_record_id);
    },
  );

  ipcMain.handle(
    "capture:list",
    async (
      _,
      query?: CaptureQuery,
    ): Promise<ApiResponse<CaptureListItem[]>> => {
      return listCaptures(query);
    },
  );

  ipcMain.handle(
    "capture:getByDateRange",
    async (
      _,
      startDate?: string,
      endDate?: string,
    ): Promise<ApiResponse<CaptureDateListItem[]>> => {
      return getCapturesByDateRange(startDate, endDate);
    },
  );
}
