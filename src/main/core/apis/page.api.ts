import { pageService } from "@/main/core/services/page.service";
import { response } from "@/main/utils/response";
import { ErrorCode, type PageType } from "@/shared/enums";
import type { ApiResponse } from "@/shared/types";
import type { Page, PageTree } from "@/main/types/db";
import type { CreatePageInput, UpdatePageInput, PageQuery } from "@/shared/types/page.types";
import type { PaginationResult } from "@/shared/utils/pagination";
import { Logger } from "@/main/utils/logger";

async function getPage(id: string): Promise<ApiResponse<Page | null>> {
  try {
    const page = pageService.getPage(id);
    if (page) {
      return response.success(page);
    } else {
      return response.error(ErrorCode.PAGE_NOT_FOUND);
    }
  } catch (error) {
    Logger.error("获取页面失败", { error: JSON.stringify(error), id });
    return response.error(ErrorCode.PAGE_GET_FAILED, error as Error);
  }
}

async function paginatePages(params: {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: "ASC" | "DESC";
  conditions?: PageQuery;
}): Promise<ApiResponse<PaginationResult<Page>>> {
  try {
    const result = pageService.paginatePages(params);
    Logger.debug("分页查询页面成功", { params, result });
    return response.success(result);
  } catch (error) {
    Logger.error("分页查询页面失败", { error: JSON.stringify(error), params });
    return response.error(ErrorCode.PAGE_LIST_FAILED, error as Error);
  }
}

async function getPageTree(
  projectId: string,
  pageType: PageType,
): Promise<ApiResponse<PageTree[]>> {
  try {
    const tree = pageService.getPageTree(projectId, pageType);
    return response.success(tree);
  } catch (error) {
    Logger.error("获取页面树失败", {
      error: JSON.stringify(error),
      projectId,
      pageType,
    });
    return response.error(ErrorCode.PAGE_QUERY_FAILED, error as Error);
  }
}

async function createPage(data: CreatePageInput): Promise<ApiResponse<string>> {
  try {
    const id = pageService.createPage(data);
    return response.success(id);
  } catch (error) {
    Logger.error("创建页面失败", { error: JSON.stringify(error), data });
    return response.error(ErrorCode.PAGE_CREATE_FAILED, error as Error);
  }
}

async function updatePage(
  data: UpdatePageInput,
): Promise<ApiResponse<number>> {
  try {
    const changes = pageService.updatePage(data);
    if (changes > 0) {
      return response.success(changes);
    } else {
      return response.error(ErrorCode.PAGE_NOT_FOUND);
    }
  } catch (error) {
    Logger.error("更新页面失败", { error: JSON.stringify(error), id: data.id, data });
    return response.error(ErrorCode.PAGE_UPDATE_FAILED, error as Error);
  }
}

async function deletePage(id: string): Promise<ApiResponse<number>> {
  try {
    const changes = pageService.deletePage(id);
    if (changes > 0) {
      return response.success(changes);
    } else {
      return response.error(ErrorCode.PAGE_NOT_FOUND);
    }
  } catch (error) {
    Logger.error("删除页面失败", { error: JSON.stringify(error), id });
    return response.error(ErrorCode.PAGE_DELETE_FAILED, error as Error);
  }
}

export {
  getPage,
  paginatePages,
  getPageTree,
  createPage,
  updatePage,
  deletePage,
};
