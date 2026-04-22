// 基础类型别名（复用file.types.ts中的定义）
type WorkTagId = number
type WorkId = number
type Timestamp = string

// 作品标签特定类型
type TagName = string

// 高级类型验证工具
type NonEmptyString<T extends string> = T extends '' ? never : T
type PositiveNumber<T extends number> = T extends 0 ? never : T extends -1 ? never : T

// 类型断言工具
type Assert<T, U> = T extends U ? T : never
type Ensure<T, U> = T & U

// 字段约束类型
type ValidTagName = NonEmptyString<string>
type ValidWorkId = PositiveNumber<number>

export interface WorkTag {
  id: WorkTagId
  work_id: WorkId
  tag_name: TagName
  created_at: Timestamp
}

// 必填字段
type WorkTagRequiredFields = {
  work_id: WorkId
  tag_name: TagName
}

export interface WorkTagCreate extends WorkTagRequiredFields {
  created_at?: Timestamp
}

export interface WorkTagUpdate extends Partial<WorkTagRequiredFields> {}

// 严格验证的作品标签创建类型
export type StrictWorkTagCreate = Ensure<WorkTagCreate, {
  work_id: ValidWorkId
  tag_name: ValidTagName
}>

// 作品标签查询参数
export interface WorkTagQuery {
  work_id?: WorkId
  tag_name?: TagName
  page?: number
  page_size?: number
  order_by?: string
  order_dir?: 'ASC' | 'DESC'
}


// 标签分组信息
export interface TagGroup {
  tag: TagName
  works: WorkId[]
  count: number
  firstUsed: Timestamp
  lastUsed: Timestamp
}

// 示例：使用严格验证的作品标签创建
// const validTag: StrictWorkTagCreate = {
//   work_id: 1, // 必须是正数
//   tag_name: 'fantasy' // 必须是非空字符串
// }

// 示例：无效的作品标签创建（会在编译时报错）
// const invalidTag: StrictWorkTagCreate = {
//   work_id: 0, // 错误：无效的作品ID
//   tag_name: '' // 错误：空标签名
// }
