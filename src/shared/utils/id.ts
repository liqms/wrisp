/**
 * ID 生成工具函数
 */

/**
 * 生成唯一 ID
 * @returns 唯一 ID 字符串
 */
export function generateId(): string {
  return crypto.randomUUID()
}
