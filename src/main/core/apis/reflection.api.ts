import { reflectionService } from "@/main/core/services/reflection.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type { ApiResponse } from "@/shared/types";
import type {
  Reflection,
  ReflectionWithBlocks,
} from "@/main/types/db";
import type { PaginationResult } from "@/shared/utils/pagination";
import { Logger } from "@/main/utils/logger";

// ==================== 反思 ====================

async function paginateReflections(params: {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: "ASC" | "DESC";
  conditions?: Record<string, unknown>;
}): Promise<ApiResponse<PaginationResult<Reflection>>> {
  try {
    const result = reflectionService.paginateReflections(params);
    return response.success(result);
  } catch (error) {
    Logger.error("分页查询反思失败", { error: JSON.stringify(error), params });
    return response.error(ErrorCode.REFLECTION_LIST_FAILED, error as Error);
  }
}

async function getReflectionDetail(
  id: string,
): Promise<ApiResponse<ReflectionWithBlocks | null>> {
  try {
    const reflection = reflectionService.getReflectionDetail(id);
    if (reflection) {
      return response.success(reflection);
    }
    return response.error(ErrorCode.REFLECTION_NOT_FOUND);
  } catch (error) {
    Logger.error("获取反思详情失败", { error: JSON.stringify(error), id });
    return response.error(ErrorCode.REFLECTION_GET_FAILED, error as Error);
  }
}

export {
  paginateReflections,
  getReflectionDetail,
};