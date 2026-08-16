/**
 * 统一 API 响应结构
 */

import { ErrorCode } from "../enums";

/**
 * 基础响应接口
 */
export interface BaseResponse<T = unknown> {
  code: ErrorCode; // 状态码
  data?: T; // 数据
  timestamp: string | number; // 时间戳
  success: boolean; // 是否成功
}

/**
 * 成功响应
 */
export interface SuccessResponse<T = unknown> extends BaseResponse<T> {
  code: ErrorCode.SUCCESS;
  success: true;
  data: T;
}

/**
 * 错误响应
 */
export interface ErrorResponse extends BaseResponse {
  code: ErrorCode;
  success: false;
  data?: never;
  error?: {
    type: string; // 错误类型
    details?: Record<string, unknown>; // 错误详情
    stack?: string; // 错误堆栈
  };
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T = unknown> extends SuccessResponse<T[]> {
  pagination: {
    page: number; // 当前页码
    pageSize: number; // 每页数量
    total: number; // 总数量
    totalPages: number; // 总页数
    hasNext: boolean; // 是否有下一页
    hasPrev: boolean; // 是否有上一页
    startIndex: number; // 开始索引
    endIndex: number; // 结束索引
  };
}

/**
 * 列表响应
 */
export interface ListResponse<T = unknown> extends SuccessResponse<T[]> {
  total: number; // 总数量
}

/**
 * 响应包装器选项
 */
export interface ResponseOptions {
  timestamp?: number; // 自定义时间戳
  includeErrorDetails?: boolean; // 是否包含错误详情
}

/**
 * 响应创建器类型
 */
export type ResponseCreator = {
  success: <T = unknown>(data: T, options?: ResponseOptions) => SuccessResponse<T>;
  error: (
    code: ErrorCode,
    error?: Error,
    options?: ResponseOptions,
  ) => ErrorResponse;
  paginated: <T = unknown>(
    data: T[],
    total: number,
    page: number,
    pageSize: number,
    totalPages: number,
    hasNext: boolean,
    hasPrev: boolean,
    startIndex: number,
    endIndex: number,
    options?: ResponseOptions,
  ) => PaginatedResponse<T>;
  list: <T = unknown>(
    data: T[],
    total: number,
    options?: ResponseOptions,
  ) => ListResponse<T>;
  created: <T = unknown>(data: T, options?: ResponseOptions) => SuccessResponse<T>;
  noContent: (options?: ResponseOptions) => SuccessResponse<null>;
};

export type ApiResponse<T = unknown> =
  | SuccessResponse<T>
  | ErrorResponse
  | PaginatedResponse<T>
  | ListResponse<T>
  | SuccessResponse<null>;
