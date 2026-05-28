// 基础类型别名定义
// 这些类型在前后端之间共享使用

export type Id = string
export type Timestamp = string
export type FilePath = string
export type FileExtension = string
export type FileSize = number
export type HashValue = string
export type WordCount = number
export type Duration = number
export type FileCount = number
export type FolderCount = number

// 通用文本类型
export type Name = string
export type Description = string
export type Content = string
export type Notes = string
export type Metadata = string
export type JsonMetadata = Record<string, string>
export type ErrorMessage = string
export type Checksum = string
export type VersionString = string
export type Color = string

// 布尔类型标记（0/1）
export type BooleanFlag = 0 | 1

// 分页/查询通用结构
export interface QueryParams {
  page?: number
  page_size?: number
  order_by?: string
  order_dir?: 'ASC' | 'DESC'
}

// 验证辅助类型
export type NonEmptyString<T extends string> = T extends '' ? never : T
export type PositiveNumber<T extends number> = T extends 0 ? never : T extends -1 ? never : T
export type ValidFilePath<T extends string> = T extends `/${string}` ? T : never

export type Assert<T, U> = T extends U ? T : never
export type Ensure<T, U> = T & U

export type ValidFilePathType = FilePath
export type ValidFileName = NonEmptyString<string>
export type ValidTagName = NonEmptyString<string>
export type ValidFolderName = NonEmptyString<string>
export type ValidWorkName = NonEmptyString<string>
export type ValidVersionString = NonEmptyString<string>
export type ValidMigrationName = NonEmptyString<string>
export type ValidSqlStatement = NonEmptyString<string>
