/**
 * 文件夹服务层类型定义
 */

import { FolderStatus } from '@/main/types/db'
import { FileBasicInfo } from './file.types'

/**
 * 文件夹基本信息
 */
export interface FolderBasicInfo {
  id: number
  parent_id?: number | null
  work_id?: number | null
  files_count?: number
  folders_count?: number
  size?: number
}

/**
 * 创建文件夹请求参数
 */
export interface CreateFolderRequest {
  parent_id?: number
  work_id?: number
  work_type: string
  name: string
  description?: string
}

/**
 * 更新文件夹请求参数
 */
export interface UpdateFolderRequest {
  parent_id?: number
  work_id?: number
  name?: string
  description?: string
}

/**
 * 文件夹查询请求参数
 */
export interface FolderQueryRequest {
  parent_id?: number
  work_id?: number
  name?: string
  path?: string
  status?: FolderStatus
  page?: number
  page_size?: number
  order_by?: string
  order_dir?: 'ASC' | 'DESC'
}

/**
 * 文件夹树节点（包含层级信息）
 */
export interface FolderTreeNode extends FolderBasicInfo {
  level: number
  children: FolderTreeNode[]
}

/**
 * 文件夹树节点（包含统计信息）
 */
export interface FolderTreeWithStats extends FolderBasicInfo {
  level: number
  children: FolderTreeWithStats[]
  total_file_count: number
  total_folder_count: number
  total_size: number
}

/**
 * 文件夹列表和文件列表
 */
export interface FoldersAndFilesList {
  folders: FolderBasicInfo[]
  files: FileBasicInfo[]
}
