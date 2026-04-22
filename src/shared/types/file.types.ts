/**
 * 文件服务层类型定义
 */

import { BaseResponse, ListResponse } from './apis/base.types'
import { File, FileStatus, FileType } from '@/main/types/db'

/**
 * 创建文件请求参数
 */
export interface CreateFileRequest {
  work_id: number
  folder_id: number
  name: string
  content?: string
  extension?: string
}

/**
 * 更新文件请求参数
 */
export interface UpdateFileRequest {
  name?: string
  content?: string
}

/**
 * 文件查询请求参数
 */
export interface FileQueryRequest {
  work_id?: number
  folder_id?: number
  name?: string
  primary_type?: string
  extension?: string
  type?: FileType
  status?: FileStatus
  page?: number
  page_size?: number
  order_by?: string
  order_dir?: 'ASC' | 'DESC'
}

/**
 * 文件统计信息
 */
export interface FileAggregate {
  file_count: number
  total_size: number
  word_count: number
  types: { type: string; count: number }[]
}

/**
 * 创建文件响应
 */
export type CreateFileResponse = BaseResponse<File>

/**
 * 获取文件响应
 */
export type GetFileResponse = BaseResponse<File | null>

/**
 * 获取文件列表响应
 */
export type GetFileListResponse = ListResponse<File>

/**
 * 更新文件响应
 */
export type UpdateFileResponse = BaseResponse<number>

/**
 * 删除文件响应
 */
export type DeleteFileResponse = BaseResponse<number>

/**
 * 文件统计响应
 */
export type GetFileAggregateResponse = BaseResponse<FileAggregate>
