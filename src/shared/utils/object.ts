/**
 * 对象工具类
 * 提供常用的对象操作工具方法
 */
export class ObjectUtil {
  /**
   * 获取对象属性值（支持路径）
   * @param obj - 对象
   * @param path - 属性路径
   * @param defaultValue - 默认值
   * @returns 属性值或默认值
   */
  static get<T>(obj: unknown, path: string | string[], defaultValue?: T): T | undefined {
    const keys = Array.isArray(path) ? path : path.split('.')
    let result: unknown = obj

    for (const key of keys) {
      if (result === null || result === undefined) {
        return defaultValue
      }
      result = (result as Record<string, unknown>)[key]
    }

    return result === undefined ? defaultValue : (result as T)
  }

  /**
   * 设置对象属性值（支持路径）
   * @param obj - 对象
   * @param path - 属性路径
   * @param value - 要设置的值
   * @returns 更新后的对象
   */
  static set<T extends object>(obj: T, path: string | string[], value: unknown): T {
    const keys = Array.isArray(path) ? path : path.split('.')
    const clonedObj = this.deepClone(obj)
    let current: unknown = clonedObj

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      if (i === keys.length - 1) {
        (current as Record<string, unknown>)[key] = value
      } else {
        if (!(current as Record<string, unknown>)[key] || typeof (current as Record<string, unknown>)[key] !== 'object') {
          (current as Record<string, unknown>)[key] = {}
        }
        current = (current as Record<string, unknown>)[key]
      }
    }

    return clonedObj
  }

  /**
   * 检查对象是否有指定属性（支持路径）
   * @param obj - 对象
   * @param path - 属性路径
   * @returns 是否有该属性
   */
  static has(obj: unknown, path: string | string[]): boolean {
    const keys = Array.isArray(path) ? path : path.split('.')
    let current: unknown = obj

    for (const key of keys) {
      if (current === null || current === undefined) {
        return false
      }
      if (!(key in (current as Record<string, unknown>))) {
        return false
      }
      current = (current as Record<string, unknown>)[key]
    }

    return true
  }

  /**
   * 深拷贝对象
   * @param obj - 对象
   * @returns 拷贝后的新对象
   */
  static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as unknown as T
    }

    if (obj instanceof Array) {
      return obj.map(item => this.deepClone(item)) as unknown as T
    }

    if (obj instanceof Map) {
      const clonedMap = new Map()
      obj.forEach((value, key) => {
        clonedMap.set(this.deepClone(key), this.deepClone(value))
      })
      return clonedMap as unknown as T
    }

    if (obj instanceof Set) {
      const clonedSet = new Set()
      obj.forEach(value => {
        clonedSet.add(this.deepClone(value))
      })
      return clonedSet as unknown as T
    }

    if (typeof obj === 'object') {
      const clonedObj = {} as T
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          clonedObj[key] = this.deepClone(obj[key])
        }
      }
      return clonedObj
    }

    return obj
  }

  /**
   * 深度合并对象
   * @param target - 目标对象
   * @param sources - 源对象列表
   * @returns 合并后的对象
   */
  static deepMerge<T extends object>(target: T, ...sources: Partial<T>[]): T {
    const result = this.deepClone(target)

    for (const source of sources) {
      if (source && typeof source === 'object') {
        this._deepMerge(result, source)
      }
    }

    return result
  }

  private static _deepMerge(target: unknown, source: unknown): void {
    if (!source || typeof source !== 'object') return

    for (const key in source as Record<string, unknown>) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = (source as Record<string, unknown>)[key]
        const targetValue = (target as Record<string, unknown>)[key]

        if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
          if (!targetValue || typeof targetValue !== 'object' || Array.isArray(targetValue)) {
            (target as Record<string, unknown>)[key] = this.deepClone(sourceValue)
          } else {
            this._deepMerge(targetValue, sourceValue)
          }
        } else {
          (target as Record<string, unknown>)[key] = this.deepClone(sourceValue)
        }
      }
    }
  }

  /**
   * 检查两个对象是否深度相等
   * @param obj1 - 第一个对象
   * @param obj2 - 第二个对象
   * @returns 是否深度相等
   */
  static deepEquals(obj1: unknown, obj2: unknown): boolean {
    if (obj1 === obj2) return true

    if (obj1 === null || obj2 === null || typeof obj1 !== typeof obj2) return false

    if (Array.isArray(obj1) && Array.isArray(obj2)) {
      if (obj1.length !== obj2.length) return false
      for (let i = 0; i < obj1.length; i++) {
        if (!this.deepEquals(obj1[i], obj2[i])) return false
      }
      return true
    }

    if (typeof obj1 === 'object' && typeof obj2 === 'object') {
      const keys1 = Object.keys(obj1 as Record<string, unknown>)
      const keys2 = Object.keys(obj2 as Record<string, unknown>)

      if (keys1.length !== keys2.length) return false

      const keys2Set = new Set(keys2)
      for (const key of keys1) {
        if (!keys2Set.has(key) || !this.deepEquals((obj1 as Record<string, unknown>)[key], (obj2 as Record<string, unknown>)[key])) {
          return false
        }
      }

      return true
    }

    return false
  }

  /**
   * 从对象中提取指定属性
   * @param obj - 对象
   * @param keys - 要提取的属性名列表
   * @returns 提取后的新对象
   */
  static pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const result = {} as Pick<T, K>

    for (const key of keys) {
      if (key in obj) {
        result[key] = obj[key]
      }
    }

    return result
  }

  /**
   * 从对象中排除指定属性
   * @param obj - 对象
   * @param keys - 要排除的属性名列表
   * @returns 排除后的新对象
   */
  static omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    const result = {} as Omit<T, K>

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key) && !keys.includes(key as unknown as K)) {
        ;(result as Record<string, unknown>)[key] = obj[key]
      }
    }

    return result
  }
}

export const objectUtil = ObjectUtil