/**
 * 文件服务层类型定义
 */

import { FileStatus, FileType } from '@/main/types/db'

/**
 * 文件基本信息
 */
export interface FileBasicInfo {
  id: number
  work_id: number
  folder_id: number
  name: string
  content?: string
  type: FileType
  primary_type?: string
  extension?: string
  duration?: number
  status: FileStatus
  size: number
  word_count: number
}

/**
 * 创建文件请求参数
 */
export interface CreateFileRequest {
  work_id: number
  folder_id: number
  name: string
  primary_type: string
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
  work_id: number
  folder_id: number
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

