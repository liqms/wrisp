import { captureService } from "@/main/core/services/capture.service";
import { response } from "@/main/utils/response";
import { ErrorCode, SearchType } from "@/shared/enums";
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
import { Logger } from "@/main/utils/logger";

/**
 * 创建记录
 * @param record 创建记录参数
 * @returns 创建的记录 ID
 */
async function createCapture(
  record: CaptureCreate,
): Promise<ApiResponse<CaptureDetail | null>> {
  try {
    const id = captureService.create(record);
    const detail = captureService.getById(id);
    return response.success(detail);
  } catch (error) {
    Logger.error("创建记录失败", { error: JSON.stringify(error), record });
    return response.error(ErrorCode.CAPTURE_CREATE_FAILED, error as Error);
  }
}

/**
 * 更新记录
 * @param record 更新记录参数
 * @returns 更新结果
 */
async function updateCapture(
  record: CaptureUpdate,
): Promise<ApiResponse<CaptureDetail | null>> {
  try {
    const result = captureService.update(record);
    if (!result) {
      return response.error(ErrorCode.CAPTURE_UPDATE_FAILED);
    }
    const detail = captureService.getById(record.id);
    return response.success(detail);
  } catch (error) {
    Logger.error("更新记录失败", { error: JSON.stringify(error), record });
    return response.error(ErrorCode.CAPTURE_UPDATE_FAILED, error as Error);
  }
}

/**
 * 获取最近的记录列表
 * @param limit 返回数量限制，默认 50
 * @returns 最近的记录列表
 */
async function getRecentCaptures(
  limit?: number,
): Promise<ApiResponse<CaptureListItem[]>> {
  try {
    const records = captureService.getRecent(limit);
    return response.success(records);
  } catch (error) {
    Logger.error("获取最近记录失败", { error: JSON.stringify(error), limit });
    return response.error(ErrorCode.CAPTURE_GET_FAILED, error as Error);
  }
}

/**
 * 删除记录
 * @param id 记录 ID
 * @returns 删除结果
 */
async function deleteCapture(id: Id): Promise<ApiResponse<null>> {
  try {
    const result = captureService.delete(id);
    if (!result) {
      return response.error(ErrorCode.CAPTURE_DELETE_FAILED);
    }
    return response.empty();
  } catch (error) {
    Logger.error("删除记录失败", { error: JSON.stringify(error), id });
    return response.error(ErrorCode.CAPTURE_DELETE_FAILED, error as Error);
  }
}

/**
 * 搜索记录
 * @param keyword 搜索关键词
 * @param limit 返回数量限制
 * @param searchType 搜索类型
 * @param parent_record_id 父记录 ID 过滤
 * @returns 匹配的记录列表
 */
async function searchCaptures(
  keyword: string,
  limit?: number,
  searchType?: SearchType,
  parent_record_id?: Id | null,
): Promise<ApiResponse<CaptureListItem[]>> {
  try {
    const records = await captureService.search(
      keyword,
      limit,
      searchType,
      parent_record_id,
    );
    return response.success(records);
  } catch (error) {
    Logger.error("搜索记录失败", {
      error: JSON.stringify(error),
      keyword,
      limit,
      searchType,
    });
    return response.error(ErrorCode.CAPTURE_QUERY_FAILED, error as Error);
  }
}

/**
 * 根据日期范围查询记录列表
 * @param startDate 起始日期（ISO 8601 字符串），可选
 * @param endDate 结束日期（ISO 8601 字符串），可选
 * @returns 日期范围内的记录列表，或不传时返回最近 20 条
 */
async function getCapturesByDateRange(
  startDate?: string,
  endDate?: string,
): Promise<ApiResponse<CaptureDateListItem[]>> {
  try {
    const records = captureService.getByDateRange(startDate, endDate);
    return response.success(records);
  } catch (error) {
    Logger.error("根据日期范围查询记录失败", {
      error: JSON.stringify(error),
      startDate,
      endDate,
    });
    return response.error(ErrorCode.CAPTURE_GET_FAILED, error as Error);
  }
}

/**
 * 分页查询记录列表
 * @param query 查询条件
 * @returns 分页的记录列表
 */
async function listCaptures(
  query?: CaptureQuery,
): Promise<ApiResponse<CaptureListItem[]>> {
  try {
    const result = captureService.list(query);
    return response.paginated(
      result.data,
      result.total,
      result.page,
      result.pageSize,
      result.totalPages,
      result.hasNext,
      result.hasPrev,
      result.startIndex,
      result.endIndex,
    );
  } catch (error) {
    Logger.error("分页查询记录失败", { error: JSON.stringify(error), query });
    return response.error(ErrorCode.CAPTURE_QUERY_FAILED, error as Error);
  }
}

export {
  createCapture,
  updateCapture,
  getRecentCaptures,
  deleteCapture,
  searchCaptures,
  listCaptures,
  getCapturesByDateRange,
};
