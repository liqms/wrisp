import { ipcRenderer } from "electron";
import type { CaptureAPI } from "../types/capture";
import type {
  CaptureCreate,
  CaptureUpdate,
  CaptureQuery,
  CaptureListItem,
  CaptureDetail,
  CaptureDateListItem,
  Id,
  ApiResponse,
} from "@/shared/types";
import type { SearchType } from "@/shared/enums";

export const captureModule: CaptureAPI = {
  createCapture: (record: CaptureCreate) =>
    ipcRenderer.invoke("capture:create", record) as Promise<
      ApiResponse<CaptureDetail | null>
    >,
  updateCapture: (record: CaptureUpdate) =>
    ipcRenderer.invoke("capture:update", record) as Promise<
      ApiResponse<CaptureDetail | null>
    >,
  getRecentCaptures: (limit?: number) =>
    ipcRenderer.invoke("capture:getRecent", limit) as Promise<
      ApiResponse<CaptureListItem[]>
    >,
  deleteCapture: (id: Id) =>
    ipcRenderer.invoke("capture:delete", id) as Promise<ApiResponse<null>>,
  searchCaptures: (
    keyword: string,
    limit?: number,
    searchType?: SearchType,
    parent_record_id?: Id | null,
  ) =>
    ipcRenderer.invoke(
      "capture:search",
      keyword,
      limit,
      searchType,
      parent_record_id,
    ) as Promise<ApiResponse<CaptureListItem[]>>,
  listCaptures: (query?: CaptureQuery) =>
    ipcRenderer.invoke("capture:list", query) as Promise<
      ApiResponse<CaptureListItem[]>
    >,
  getCapturesByDateRange: (startDate?: string, endDate?: string) =>
    ipcRenderer.invoke("capture:getByDateRange", startDate, endDate) as Promise<
      ApiResponse<CaptureDateListItem[]>
    >,
};
