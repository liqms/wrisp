import { tagService } from "@/main/core/services/tag.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type {
  Tag,
  TagCreate,
  TagUpdate,
  TagQuery,
  TagDetail,
  TagId,
  ApiResponse,
} from "@/shared/types";
import { Logger } from "@/main/utils/logger";

/**
 * 根据 ID 获取标签详情
 */
async function getDetailById(
  id: TagId,
): Promise<ApiResponse<TagDetail | null>> {
  try {
    const tag = tagService.getDetailById(id);
    return response.success(tag);
  } catch (error) {
    Logger.error("获取标签失败", { error: String(error), id });
    return response.error(ErrorCode.TAG_GET_FAILED, error as Error);
  }
}

/**
 * 查询标签（精确/模糊）
 */
async function findTags(
  name: string,
  options?: { exact?: boolean; limit?: number },
): Promise<ApiResponse<Tag[]>> {
  try {
    const tags = tagService.findTags(name, options);
    return response.success(tags);
  } catch (error) {
    Logger.error("查询标签失败", { error: String(error), name, options });
    return response.error(ErrorCode.TAG_QUERY_FAILED, error as Error);
  }
}

/**
 * 获取所有标签及使用次数
 */
async function getAllTags(
  entityType?: string,
): Promise<ApiResponse<TagDetail[]>> {
  try {
    const tags = tagService.getAllTags(entityType);
    return response.success(tags);
  } catch (error) {
    Logger.error("获取标签列表失败", { error: String(error), entityType });
    return response.error(ErrorCode.TAG_GET_FAILED, error as Error);
  }
}

/**
 * 分页查询标签
 */
async function paginateTags(params: {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: "ASC" | "DESC";
  conditions?: TagQuery;
}): Promise<ApiResponse<unknown>> {
  try {
    const result = tagService.paginateTags(params);
    return response.success(result);
  } catch (error) {
    Logger.error("分页查询标签失败", { error: String(error), params });
    return response.error(ErrorCode.TAG_QUERY_FAILED, error as Error);
  }
}

/**
 * 创建单个或批量标签
 */
async function createTags(
  data: TagCreate | TagCreate[],
): Promise<ApiResponse<string | string[]>> {
  try {
    const ids = tagService.createTags(data);
    return response.success(ids);
  } catch (error) {
    Logger.error("创建标签失败", { error: String(error), data });
    return response.error(ErrorCode.TAG_CREATE_FAILED, error as Error);
  }
}

/**
 * 更新单个或批量标签
 */
async function updateTag(
  items:
    | { id: TagId; data: TagUpdate }
    | { id: TagId; data: TagUpdate }[],
): Promise<ApiResponse<number | number[]>> {
  try {
    const result = tagService.updateTag(items);
    return response.success(result);
  } catch (error) {
    Logger.error("更新标签失败", { error: String(error), items });
    return response.error(ErrorCode.TAG_UPDATE_FAILED, error as Error);
  }
}

/**
 * 删除单个或批量标签
 */
async function deleteTag(
  ids: TagId | TagId[],
): Promise<ApiResponse<number>> {
  try {
    const result = tagService.deleteTag(ids);
    return response.success(result);
  } catch (error) {
    Logger.error("删除标签失败", { error: String(error), ids });
    return response.error(ErrorCode.TAG_DELETE_FAILED, error as Error);
  }
}

export {
  getDetailById,
  findTags,
  getAllTags,
  paginateTags,
  createTags,
  updateTag,
  deleteTag,
};