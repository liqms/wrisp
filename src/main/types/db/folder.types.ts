// 基础类型别名（复用file.types.ts中的定义）
type FolderId = number
type ParentFolderId = number | null
type WorkId = number | null
type FileSize = number
type Timestamp = string
type FilePath = string

// 文件夹特定类型
type FolderName = string
type FolderDescription = string | null
type FileCount = number
type FolderCount = number

// 高级类型验证工具
type NonEmptyString<T extends string> = T extends '' ? never : T
type PositiveNumber<T extends number> = T extends 0 ? never : T extends -1 ? never : T

// 类型断言工具
type Assert<T, U> = T extends U ? T : never
type Ensure<T, U> = T & U

// 字段约束类型
type ValidFolderName = NonEmptyString<string>
type ValidFilePathType = FilePath
type ValidFileCount = PositiveNumber<number>
type ValidFolderCount = PositiveNumber<number>

export interface Folder {
  id: FolderId
  parent_id: ParentFolderId
  work_id: WorkId
  name: FolderName
  path: FilePath
  full_path: FilePath
  primary_type: string | null
  size: FileSize
  file_count: FileCount
  folder_count: FolderCount
  created_at: Timestamp
  updated_at: Timestamp
  status: FolderStatus
  description: FolderDescription
}

export type FolderStatus = 0 | 1 | 2

// 必填字段
type FolderRequiredFields = {
  name: FolderName
  path: FilePath
  full_path: FilePath
}

// 可选字段
type FolderOptionalFields = {
  parent_id?: ParentFolderId
  work_id?: WorkId
  primary_type?: string | null
  size?: FileSize
  file_count?: FileCount
  folder_count?: FolderCount
  description?: FolderDescription
  status?: FolderStatus
}

export interface FolderCreate extends FolderRequiredFields, FolderOptionalFields { 
  created_at?: Timestamp
}

export interface FolderUpdate extends Partial<FolderRequiredFields>, FolderOptionalFields {
  updated_at?: Timestamp
}

// 严格验证的文件夹创建类型
export type StrictFolderCreate = Ensure<FolderCreate, {
  name: ValidFolderName
  path: ValidFilePathType
  file_count: ValidFileCount
  folder_count: ValidFolderCount
}>

// 文件夹查询参数
export interface FolderQuery {
  parent_id?: ParentFolderId
  work_id?: WorkId
  name?: FolderName
  path?: FilePath
  primary_type?: string | null
  status?: FolderStatus
  page?: number
  page_size?: number
  order_by?: string
  order_dir?: 'ASC' | 'DESC'
}

// 文件夹树结构
export interface FolderTree {
  id: FolderId
  name: FolderName
  path: FilePath
  full_path: FilePath
  size: FileSize
  file_count: FileCount
  folder_count: FolderCount
  children?: FolderTree[]
  depth: number
  isLeaf: boolean
}

// 示例：使用严格验证的文件夹创建
// const validFolder: StrictFolderCreate = {
//   name: 'Documents', // 必须是非空字符串
//   path: '/path/to/folder', // 必须是有效路径格式
//   file_count: 10, // 必须是正数
//   folder_count: 2 // 必须是正数
// }

// 示例：无效的文件夹创建（会在编译时报错）
// const invalidFolder: StrictFolderCreate = {
//   name: '', // 错误：空字符串
//   path: 'invalid-path', // 错误：不是有效路径格式
//   file_count: -1, // 错误：负数
//   folder_count: -1 // 错误：负数
// }
