/**
 * 统一响应包装器工具
 */
import { ErrorCode } from "@/shared/enums";
import {
  SuccessResponse,
  ErrorResponse,
  PaginatedResponse,
  ListResponse,
  ResponseOptions,
} from "@/shared/types/api.types";
import { TimeUtil } from "@/shared/utils";

/**
 * 响应包装器类
 */
export class ResponseWrapper {
  /**
   * 创建成功响应
   */
  static success<T = unknown>(
    data: T,
    options: ResponseOptions = {},
  ): SuccessResponse<T> {
    const { timestamp = Date.now() } = options;

    return {
      code: ErrorCode.SUCCESS,
      data,
      timestamp: TimeUtil.toISOString(timestamp),
      success: true,
    };
  }

  /**
   * 创建错误响应
   */
  static error(
    code: ErrorCode,
    error?: Error,
    options: ResponseOptions = {},
  ): ErrorResponse {
    const { timestamp = Date.now(), includeErrorDetails = false } = options;

    const errorResponse: ErrorResponse = {
      code,
      timestamp: TimeUtil.toISOString(timestamp),
      success: false,
    };

    if (error && includeErrorDetails) {
      errorResponse.error = {
        type: error.name,
        details: { message: error.message },
        stack: error.stack,
      };
    }

    return errorResponse;
  }

  /**
   * 创建分页响应
   */
  static paginated<T = unknown>(
    data: T[],
    total: number,
    page: number,
    pageSize: number,
    totalPages: number,
    hasNext: boolean,
    hasPrev: boolean,
    startIndex: number,
    endIndex: number,
    options: ResponseOptions = {},
  ): PaginatedResponse<T> {
    const { timestamp = Date.now() } = options;

    return {
      code: ErrorCode.SUCCESS,
      data,
      timestamp: TimeUtil.toISOString(timestamp),
      success: true,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext,
        hasPrev,
        startIndex,
        endIndex,
      },
    };
  }

  /**
   * 创建列表响应
   */
  static list<T = unknown>(
    data: T[],
    total: number,
    options: ResponseOptions = {},
  ): ListResponse<T> {
    const { timestamp = Date.now() } = options;

    return {
      code: ErrorCode.SUCCESS,
      data,
      timestamp: TimeUtil.toISOString(timestamp),
      success: true,
      total,
    };
  }

  /**
   * 创建空响应
   */
  static empty(options: ResponseOptions = {}): SuccessResponse<null> {
    const { timestamp = Date.now() } = options;

    return {
      code: ErrorCode.SUCCESS,
      data: null,
      timestamp: TimeUtil.toISOString(timestamp),
      success: true,
    };
  }
}

export const response = ResponseWrapper;
