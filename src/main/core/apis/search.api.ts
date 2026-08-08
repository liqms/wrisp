import { searchService } from "@/main/core/services/search.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type { ApiResponse } from "@/shared/types";
import { Logger } from "@/main/utils/logger";

/**
 * 执行搜索
 * @param keyword 搜索关键词
 * @param limit 返回数量限制
 */
async function search(
  keyword: string,
  limit?: number,
): Promise<ApiResponse<any[]>> {
  try {
    const results = await searchService.search(keyword, limit);
    return response.success(results);
  } catch (error) {
    Logger.error("搜索失败", { error: JSON.stringify(error), keyword, limit });
    return response.error(ErrorCode.COMMON_UNKNOWN, error as Error);
  }
}

export { search };