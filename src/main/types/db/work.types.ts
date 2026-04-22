// 基础类型别名（复用file.types.ts中的定义）
type WorkId = number
type Timestamp = string
type FilePath = string

// 作品特定类型
type WorkName = string
type CoverImage = FilePath
type TargetAudience = string
type WorkType = string
type Description = string
type ChapterCount = number
type WordCount = number
type AuthorNotes = string
type CopyrightInfo = string
type FolderCount = number
type FileCount = number

// 高级类型验证工具
type NonEmptyString<T extends string> = T extends '' ? never : T
type PositiveNumber<T extends number> = T extends 0 ? never : T extends -1 ? never : T

// 类型断言工具
type Assert<T, U> = T extends U ? T : never
type Ensure<T, U> = T & U

// 字段约束类型
type ValidWorkName = NonEmptyString<string>
type ValidFilePathType = NonEmptyString<string> | null

/**
 * 作品信息
 */
export interface Work {
  id: WorkId
  name: WorkName
  cover_image: CoverImage
  category: string
  target_audience: TargetAudience
  audience_profile: string
  work_type: WorkType
  description: Description
  path: FilePath
  full_path: FilePath
  created_at: Timestamp
  updated_at: Timestamp
  status: WorkStatus
  chapter_count: ChapterCount
  word_count: WordCount
  folder_count: FolderCount
  file_count: FileCount
  total_size: number
  average_chapter_word_count: WordCount
  author_notes: AuthorNotes
  copyright_info: CopyrightInfo
  folder_id?: number
}

export type WorkStatus = 0 | 1 | 2 | 3 | 4

// 必填字段
type WorkRequiredFields = {
  name: WorkName
  work_type: WorkType
  path: FilePath
  full_path: FilePath
  folder_id: number
}

// 可选字段
type WorkOptionalFields = {
  category?: string
  cover_image?: CoverImage
  audience_profile?: string
  target_audience?: TargetAudience
  description?: Description
  chapter_count?: ChapterCount
  word_count?: WordCount
  author_notes?: AuthorNotes
  copyright_info?: CopyrightInfo
  status?: WorkStatus
  created_at?: Timestamp
}

export interface WorkCreate extends WorkRequiredFields, WorkOptionalFields {
  folder_count?: FolderCount
  file_count?: FileCount
  total_size?: number
  average_chapter_word_count?: WordCount
}

export interface WorkUpdate extends Partial<WorkRequiredFields>, WorkOptionalFields {
  folder_count?: FolderCount
  file_count?: FileCount
  total_size?: number
  average_chapter_word_count?: WordCount
  updated_at?: Timestamp
}

// 严格验证的作品创建类型
export type StrictWorkCreate = Ensure<WorkCreate, {
  name: ValidWorkName
  work_type: WorkType
  path: ValidFilePathType
  full_path: ValidFilePathType
}>

// 作品查询参数
export interface WorkQuery {
  name?: WorkName
  work_type?: WorkType
  status?: WorkStatus
  target_audience?: TargetAudience
  category?: string
  page?: number
  page_size?: number
  order_by?: string
  order_dir?: 'ASC' | 'DESC'
}

// 作品统计信息
export interface WorkStats {
  total_works: number
  total_words: WordCount
  total_chapters: ChapterCount
  total_files: FileCount
  average_word_count: WordCount
  average_chapter_count: ChapterCount
  work_types: Record<WorkType, number>
  status_distribution: Record<WorkStatus, number>
}

// 作品详细信息（包含关联数据）
export interface WorkDetail extends Work {
  folders: FolderCount
  files: FileCount
  tags: string[]
  recentActivity?: Timestamp
}

// 示例：使用严格验证的作品创建
// const validWork: StrictWorkCreate = {
//   name: 'My Novel', // 必须是非空字符串
//   work_type: 'novel', // 作品类型
//   chapter_count: 10, // 必须是正数
//   word_count: 50000, // 必须是正数
//   folder_count: 5, // 必须是正数
//   file_count: 20 // 必须是正数
// }

// 示例：无效的作品创建（会在编译时报错）
// const invalidWork: StrictWorkCreate = {
//   name: '', // 错误：空字符串
//   work_type: 'novel',
//   chapter_count: -1, // 错误：负数
//   word_count: -1, // 错误：负数
//   folder_count: -1, // 错误：负数
//   file_count: -1 // 错误：负数
// }