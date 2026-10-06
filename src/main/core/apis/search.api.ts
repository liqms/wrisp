
import { searchService } from "@/main/core/services/system/search.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type { ApiResponse, SearchResult } from "@/shared/types";
import { Logger } from "@/main/utils/logger";

/**
 * 执行搜索
 * @param keyword 搜索关键词
 * @param limit 返回数量限制
 */
async function search(
  keyword: string,
  limit?: number,
): Promise<ApiResponse<SearchResult[]>> {
  try {
    const results = await searchService.search(keyword, limit);
    return response.success(results);
  } catch (error) {
    Logger.error("搜索失败", { error: JSON.stringify(error), keyword, limit });
    return response.error(ErrorCode.COMMON_UNKNOWN, error as Error);
  }
}

/**
 * 预热本地语义搜索模型（嵌入 + 重排序）
 * 供渲染进程在打开搜索框等时机提前调用，把冷启动挪出搜索关键路径。
 */
async function warmupSearch(): Promise<ApiResponse<null>> {
  try {
    await searchService.warmup();
    return response.empty();
  } catch (error) {
    Logger.error("搜索模型预热失败", { error: JSON.stringify(error) });
    return response.error(ErrorCode.COMMON_UNKNOWN, error as Error);
  }
}

export { search, warmupSearch };