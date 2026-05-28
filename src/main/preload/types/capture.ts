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

export interface CaptureAPI {
  createCapture(record: CaptureCreate): Promise<ApiResponse<CaptureDetail | null>>;
  updateCapture(record: CaptureUpdate): Promise<ApiResponse<CaptureDetail | null>>;
  getRecentCaptures(limit?: number): Promise<ApiResponse<CaptureListItem[]>>;
  deleteCapture(id: Id): Promise<ApiResponse<null>>;
  searchCaptures(
    keyword: string,
    limit?: number,
    searchType?: SearchType,
    parent_record_id?: Id | null,
  ): Promise<ApiResponse<CaptureListItem[]>>;
  listCaptures(query?: CaptureQuery): Promise<ApiResponse<CaptureListItem[]>>;
  getCapturesByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<ApiResponse<CaptureDateListItem[]>>;
}
