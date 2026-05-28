/**
 * 通用验证工具函数
 * 提供数据验证和清理功能，用于确保输入数据的有效性和安全性
 */

/**
 * 验证数字 ID 是否有效
 * @param id - 待验证的 ID
 * @param name - 参数名称（用于错误消息）
 * @returns ID 有效返回 true，否则返回 false
 */
export function validateId(id: number | undefined, name: string = 'ID'): boolean {
  if (id === undefined || id === null) {
    return false
  }

  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
    return false
  }

  return true
}

/**
 * 验证字符串是否有效
 * @param value - 待验证的字符串
 * @param name - 参数名称（用于错误消息）
 * @param minLength - 最小长度要求（默认1）
 * @param maxLength - 最大长度限制（默认1000）
 * @returns 字符串有效返回 true，否则返回 false
 */
export function validateString(
  value: string | undefined,
  name: string = '字符串',
  minLength: number = 1,
  maxLength: number = 1000
): boolean {
  if (value === undefined || value === null) {
    return false
  }

  if (typeof value !== 'string') {
    return false
  }

  const trimmedValue = value.trim()

  if (trimmedValue.length < minLength) {
    return false
  }

  if (trimmedValue.length > maxLength) {
    return false
  }

  return true
}

/**
 * 验证文件路径是否有效
 * @param path - 待验证的文件路径
 * @param name - 参数名称（用于错误消息）
 * @returns 路径有效返回 true，否则返回 false
 */
export function validateFilePath(path: string | undefined, name: string = '文件路径'): boolean {
  if (!validateString(path, name, 1, 4096)) {
    return false
  }

  const trimmedPath = path!.trim()

  // 检查路径是否包含非法字符
  const invalidChars = /[<>:"|?*]/
  if (invalidChars.test(trimmedPath)) {
    return false
  }

  // 检查路径是否为空或只有空格
  if (trimmedPath === '' || /^\s+$/.test(trimmedPath)) {
    return false
  }

  return true
}

/**
 * 验证文件扩展名是否有效
 * @param extension - 待验证的文件扩展名
 * @param name - 参数名称（用于错误消息）
 * @returns 扩展名有效返回 true，否则返回 false
 */
export function validateFileExtension(extension: string | undefined, name: string = '文件扩展名'): boolean {
  if (!validateString(extension, name, 1, 20)) {
    return false
  }

  const trimmedExtension = extension!.trim().toLowerCase()

  // 检查扩展名格式（字母、数字、点，但点不能在最前面）
  const extensionRegex = /^[a-z0-9]+(\.[a-z0-9]+)*$/
  if (!extensionRegex.test(trimmedExtension)) {
    return false
  }

  return true
}

/**
 * 验证数字范围是否有效
 * @param value - 待验证的数字
 * @param name - 参数名称（用于错误消息）
 * @param min - 最小值（包含）
 * @param max - 最大值（包含）
 * @returns 数字在有效范围内返回 true，否则返回 false
 */
export function validateNumberRange(
  value: number | undefined,
  name: string = '数字',
  min: number = 0,
  max: number = Number.MAX_SAFE_INTEGER
): boolean {
  if (value === undefined || value === null) {
    return false
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return false
  }

  if (value < min) {
    return false
  }

  if (value > max) {
    return false
  }

  return true
}

/**
 * 验证布尔值是否有效
 * @param value - 待验证的布尔值
 * @param name - 参数名称（用于错误消息）
 * @returns 布尔值有效返回 true，否则返回 false
 */
export function validateBoolean(value: boolean | undefined, name: string = '布尔值'): boolean {
  if (value === undefined || value === null) {
    return false
  }

  if (typeof value !== 'boolean') {
    return false
  }

  return true
}

/**
 * 验证数组是否有效
 * @param array - 待验证的数组
 * @param name - 参数名称（用于错误消息）
 * @param minLength - 最小长度要求（默认0）
 * @param maxLength - 最大长度限制（默认10000）
 * @returns 数组有效返回 true，否则返回 false
 */
export function validateArray<T>(
  array: T[] | undefined,
  minLength: number = 0,
  maxLength: number = 10000
): boolean {
  if (array === undefined || array === null) {
    return false
  }

  if (!Array.isArray(array)) {
    return false
  }

  if (array.length < minLength) {
    return false
  }

  if (array.length > maxLength) {
    return false
  }

  return true
}

/**
 * 清理和验证排序字段名称
 * @param orderBy - 待清理的排序字段
 * @param allowedColumns - 允许的字段名称数组
 * @param defaultColumn - 默认字段名称
 * @returns 清理后的安全字段名
 */
export function sanitizeOrderBy(
  orderBy: string | undefined,
  allowedColumns: string[] = ['id', 'name', 'created_at', 'updated_at'],
  defaultColumn: string = 'id'
): string {
  if (!validateString(orderBy, '排序字段')) {
    return defaultColumn
  }

  const safeColumn = orderBy!.replace(/[^a-zA-Z0-9_]/g, '')
  return allowedColumns.includes(safeColumn) ? safeColumn : defaultColumn
}

/**
 * 验证电子邮件格式
 * @param email - 待验证的电子邮件
 * @param name - 参数名称（用于错误消息）
 * @returns 电子邮件格式有效返回 true，否则返回 false
 */
export function validateEmail(email: string | undefined, name: string = '电子邮件'): boolean {
  if (!validateString(email, name, 5, 254)) {
    return false
  }

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  if (!emailRegex.test(email!)) {
    return false
  }

  return true
}

/**
 * 验证 URL 格式
 * @param url - 待验证的 URL
 * @param name - 参数名称（用于错误消息）
 * @returns URL 格式有效返回 true，否则返回 false
 */
export function validateUrl(url: string | undefined, name: string = 'URL'): boolean {
  if (!validateString(url, name, 1, 2048)) {
    return false
  }

  try {
    new URL(url!)
    return true
  } catch {
    return false
  }
}

/**
 * 验证日期字符串格式
 * @param dateString - 待验证的日期字符串
 * @param name - 参数名称（用于错误消息）
 * @returns 日期格式有效返回 true，否则返回 false
 */
export function validateDateString(dateString: string | undefined, name: string = '日期'): boolean {
  if (!validateString(dateString, name, 8, 30)) {
    return false
  }

  const date = new Date(dateString!)
  if (isNaN(date.getTime())) {
    return false
  }

  return true
}

/**
 * 批量验证多个条件
 * @param validations - 验证条件数组，每个条件是一个返回布尔值的函数
 * @returns 所有条件都通过返回 true，否则返回 false
 */
export function validateAll(validations: (() => boolean)[]): boolean {
  if (!validateArray(validations)) {
    return false
  }

  for (const validation of validations) {
    if (!validation()) {
      return false
    }
  }

  return true
}

/**
 * 批量验证多个条件，返回所有失败的原因
 * @param validations - 验证条件数组，每个条件是一个返回 { valid: boolean, message?: string } 的对象
 * @returns 包含所有失败原因的对象
 */
export function validateWithMessages(validations: Array<() => { valid: boolean; message?: string }>): {
  valid: boolean;
  errors: string[]
} {
  const errors: string[] = []

  if (!validateArray(validations)) {
    return { valid: false, errors: ['验证条件数组无效'] }
  }

  for (const validation of validations) {
    const result = validation()
    if (!result.valid && result.message) {
      errors.push(result.message)
    }
  }

  return { valid: errors.length === 0, errors }
}