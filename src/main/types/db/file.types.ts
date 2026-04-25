// 基础类型别名
export type FileId = number
export type FolderId = number
export type WorkId = number
export type Timestamp = string
export type FilePath = string
export type FileExtension = string
export type FileSize = number
export type HashValue = string
export type PrimaryType = string

// 高级类型验证工具
export type NonEmptyString<T extends string> = T extends '' ? never : T
export type PositiveNumber<T extends number> = T extends 0 ? never : T extends -1 ? never : T
export type ValidFilePath<T extends string> = T extends `/${string}` ? T : never

// 类型断言工具
export type Assert<T, U> = T extends U ? T : never
export type Ensure<T, U> = T & U

// 字段约束类型
export type ValidFileName = NonEmptyString<string>
export type ValidFileSize = PositiveNumber<number>
export type ValidFilePathType = ValidFilePath<string>

export interface File {
  id: FileId
  folder_id: FolderId
  work_id: WorkId
  name: string
  primary_type: PrimaryType
  content?: string
  path: FilePath
  full_path: FilePath
  extension: FileExtension
  size: FileSize
  type: FileType
  word_count: number
  duration: number
  created_at: Timestamp
  updated_at: Timestamp
  status: FileStatus
  hash_md5: HashValue | null
  hash_sha256: HashValue | null
  is_symlink: IsSymlink
  version_number: number
}
// 是否为符号链接（0-否，1-是）
export type IsSymlink = 0 | 1

// 文件状态：0-已删除，1-正常，2-隐藏，3-只读
export type FileStatus = 0 | 1 | 2 | 3

export type FileType = 'document' | 'image' | 'video' | 'audio' | 'archive' | 'code' | 'executable' | 'other'

// 必填字段
type FileRequiredFields = {
  name: string
  path: FilePath
  full_path: FilePath
}

// 可选但有默认值的字段
type FileOptionalFields = {
  folder_id?: FolderId
  work_id?: WorkId
  extension?: FileExtension | null
  size?: FileSize
  type?: FileType
  hash_md5?: HashValue | null
  hash_sha256?: HashValue | null
  is_symlink?: IsSymlink
  version_number?: number | null
  status?: FileStatus
  word_count?: number
  duration?: number
  primary_type?: PrimaryType
}

export interface FileCreate extends FileRequiredFields, FileOptionalFields {
  created_at?: Timestamp
  updated_at?: Timestamp
}

export interface FileUpdate extends Partial<FileRequiredFields>, FileOptionalFields {
  updated_at?: Timestamp
}

// 严格验证的文件创建类型
export type StrictFileCreate = Ensure<FileCreate, {
  name: ValidFileName
  path: ValidFilePathType
  full_path: ValidFilePathType
}>

// 文件查询参数
export interface FileQuery {
  folder_id?: FolderId | null
  work_id?: WorkId | null
  name?: string
  primary_type?: PrimaryType
  path?: FilePath
  extension?: FileExtension
  type?: FileType
  status?: FileStatus
  page?: number
  page_size?: number
  order_by?: string
  order_dir?: 'ASC' | 'DESC'
}

// 示例：使用严格验证的文件创建
// const validFile: StrictFileCreate = {
//   name: 'example.txt', // 必须是非空字符串
//   path: '/path/to/file', // 必须是有效路径格式
//   size: 1024 // 必须是正数
// }

// 示例：无效的文件创建（会在编译时报错）
// const invalidFile: StrictFileCreate = {
//   name: '', // 错误：空字符串
//   path: 'invalid-path', // 错误：不是有效路径格式
//   size: -1 // 错误：负数
// }
