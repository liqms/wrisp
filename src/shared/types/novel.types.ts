/**
 * 小说服务层类型定义
 */

import { WorkStatus, WorkTag } from '@/main/types/db'
import { FolderBasicInfo } from './folder.types'
/**
 * 小说基础信息
 */
export interface NovelBaseInfo {
    id: number
    name: string
    cover_image?: string
    target_audience: string
    category: string
    audience_profile?: string
    description?: string
    author_notes?: string
    copyright_info?: string
    status?: WorkStatus
}

/**
 * 小说创建请求参数
 */
export interface CreateNovelRequest {
    name: string
    cover_image: string
    target_audience?: string
    category: string
    audience_profile?: string
    description?: string
    author_notes?: string
    copyright_info?: string
    tags?: string[]

}

/**
 * 小说更新请求参数
 */
export interface UpdateNovelRequest {
    name?: string
    cover_image?: string
    target_audience?: string
    description?: string
    category: string
    audience_profile?: string
    author_notes?: string
    copyright_info?: string
    status?: WorkStatus
    tags?: string[]
}

/**
 * 小说查询请求参数
 */
export interface NovelQueryRequest {
    status?: WorkStatus
    target_audience?: string
    category?: string
    page?: number
    page_size?: number
    order_by?: string
    order_dir?: 'ASC' | 'DESC'
}

/**
 * 小说详细信息（包含关联数据）
 */
export interface NovelDetail {
    novel: NovelBaseInfo
    tags?: WorkTag[]
    stats: {
        word_count: number
        chapter_count: number
        folder_count: number
        file_count: number
        total_size: number
        average_chapter_word_count: number
    }
    recently_updated_file: NovelChapterInfo
}

/**
 * 文件夹和文件列表
 */
export interface FolderAndFileList {
    folders: FolderBasicInfo[]
    files: NovelChapterInfo[]
}

/**
 * 小说操作请求
 */
export interface NovelOperationRequest {
    novel_id: number
    operation: 'delete' | 'archive' | 'restore' | 'update_status'
    status?: WorkStatus
}

/**
 * 小说导入请求
 */
export interface ImportNovelRequest {
    source_path: string
    target_path: string
    import_options?: {
        copy_files?: boolean
        preserve_structure?: boolean
        overwrite_existing?: boolean
        import_metadata?: boolean
    }
}

/**
 * 小说导出请求
 */
export interface ExportNovelRequest {
    novel_id: number
    export_format: 'txt' | 'epub' | 'pdf' | 'docx'
    export_options?: {
        include_metadata?: boolean
        include_images?: boolean
        split_by_chapter?: boolean
        custom_styles?: Record<string, any>
    }
    output_path: string
}

/**
 * 小说搜索请求
 */
export interface SearchNovelRequest {
    id?: number
    query: string
    status?: WorkStatus
    min_word_count?: number
    max_word_count?: number
    page?: number
    page_size?: number
    sort_by?: 'relevance' | 'word_count' | 'chapter_count' | 'created_at' | 'updated_at'
    sort_order?: 'ASC' | 'DESC'
}

/**
 * 小说搜索结果
 */
export interface SearchNovelResult {
    novel: NovelBaseInfo
    relevance_score: number
    matched_fields: string[]
    highlights?: Record<string, string[]>
}

/**
 * 小说章节信息
 */
export interface NovelChapterInfo {
    id: number
    name: string
    word_count: number
    content?: string
    size: number
}

/**
 * 小说章节创建请求参数
 */
export interface CreateChapterRequest {
    work_id: number
    folder_id: number
    name: string
    content?: string
}
/**
 * 小说章节更新请求参数
 */
export interface UpdateChapterRequest {
    name?: string
    content?: string
}

/**
 * 小说章节查询请求参数
 */
export interface ChapterQueryRequest {
    work_id: number
    folder_id: number
    page?: number
    page_size?: number
    order_by?: string
    order_dir?: 'ASC' | 'DESC'
}

