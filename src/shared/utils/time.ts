/**
 * 时间处理工具类
 * 提供常用的日期时间操作和格式化方法
 */
export class TimeUtil {
  /**
   * 格式化日期时间
   * @param date - 日期对象或时间戳
   * @param format - 格式化模板
   * @returns 格式化后的字符串
   */
  static format(date: Date | number | string, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
    const d = new Date(date)
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const day = d.getDate()
    const hours = d.getHours()
    const minutes = d.getMinutes()
    const seconds = d.getSeconds()
    const milliseconds = d.getMilliseconds()

    return format
      .replace('YYYY', year.toString())
      .replace('MM', month.toString().padStart(2, '0'))
      .replace('DD', day.toString().padStart(2, '0'))
      .replace('HH', hours.toString().padStart(2, '0'))
      .replace('mm', minutes.toString().padStart(2, '0'))
      .replace('ss', seconds.toString().padStart(2, '0'))
      .replace('SSS', milliseconds.toString().padStart(3, '0'))
  }

  /**
   * 获取时间差
   * @param start - 开始时间
   * @param end - 结束时间
   * @returns 时间差对象
   */
  static getTimeDiff(start: Date | number | string, end: Date | number | string): {
    milliseconds: number
    seconds: number
    minutes: number
    hours: number
    days: number
  } {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const diff = Math.abs(endDate.getTime() - startDate.getTime())

    return {
      milliseconds: diff,
      seconds: Math.floor(diff / 1000),
      minutes: Math.floor(diff / (1000 * 60)),
      hours: Math.floor(diff / (1000 * 60 * 60)),
      days: Math.floor(diff / (1000 * 60 * 60 * 24))
    }
  }

  /**
   * 计算相对时间
   * @param date - 日期对象或时间戳
   * @param now - 当前时间
   * @returns 相对时间字符串
   */
  static getRelativeTime(date: Date | number | string, now: Date | number | string = new Date()): string {
    const dateObj = new Date(date)
    const nowObj = new Date(now)
    const diff = nowObj.getTime() - dateObj.getTime()

    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    const months = Math.floor(days / 30)
    const years = Math.floor(days / 365)

    if (years > 0) {
      return `${years}年前`
    } else if (months > 0) {
      return `${months}个月前`
    } else if (days > 0) {
      return `${days}天前`
    } else if (hours > 0) {
      return `${hours}小时前`
    } else if (minutes > 0) {
      return `${minutes}分钟前`
    } else if (seconds > 0) {
      return `${seconds}秒前`
    } else {
      return '刚刚'
    }
  }

  /**
   * 获取指定时间的开始
   * @param date - 日期对象或时间戳
   * @returns 当天开始时间
   */
  static startOfDay(date: Date | number | string): Date {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
  }

  /**
   * 获取指定时间的结束
   * @param date - 日期对象或时间戳
   * @returns 当天结束时间
   */
  static endOfDay(date: Date | number | string): Date {
    const d = new Date(date)
    d.setHours(23, 59, 59, 999)
    return d
  }

  /**
   * 添加时间
   * @param date - 日期对象或时间戳
   * @param amount - 时间量
   * @param unit - 时间单位
   * @returns 添加后的日期
   */
  static addTime(date: Date | number | string, amount: number, unit: 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days' | 'months' | 'years'): Date {
    const d = new Date(date)

    switch (unit) {
      case 'milliseconds':
        d.setMilliseconds(d.getMilliseconds() + amount)
        break
      case 'seconds':
        d.setSeconds(d.getSeconds() + amount)
        break
      case 'minutes':
        d.setMinutes(d.getMinutes() + amount)
        break
      case 'hours':
        d.setHours(d.getHours() + amount)
        break
      case 'days':
        d.setDate(d.getDate() + amount)
        break
      case 'months':
        d.setMonth(d.getMonth() + amount)
        break
      case 'years':
        d.setFullYear(d.getFullYear() + amount)
        break
    }

    return d
  }

  /**
   * 检查是否为同一天
   * @param date1 - 第一个日期
   * @param date2 - 第二个日期
   * @returns 是否为同一天
   */
  static isSameDay(date1: Date | number | string, date2: Date | number | string): boolean {
    const d1 = new Date(date1)
    const d2 = new Date(date2)
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate()
  }

  /**
   * 检查是否为工作日
   * @param date - 日期对象或时间戳
   * @returns 是否为工作日
   */
  static isWeekday(date: Date | number | string): boolean {
    const d = new Date(date)
    const day = d.getDay()
    return day >= 1 && day <= 5
  }

  /**
   * 检查是否为周末
   * @param date - 日期对象或时间戳
   * @returns 是否为周末
   */
  static isWeekend(date: Date | number | string): boolean {
    const d = new Date(date)
    const day = d.getDay()
    return day === 0 || day === 6
  }

  /**
   * 获取当前时间戳
   * @returns 当前时间戳
   */
  static now(): number {
    return Date.now()
  }

  /**
   * 获取当前日期字符串
   * @returns 当前日期字符串
   */
  static today(): string {
    return this.format(new Date(), 'YYYY-MM-DD')
  }

  /**
   * 获取当前时间字符串
   * @returns 当前时间字符串
   */
  static currentTime(): string {
    return this.format(new Date(), 'HH:mm:ss')
  }

  /**
   * 转换为 ISO 字符串
   * @param timestamp - 时间戳或日期对象
   * @returns ISO 格式的字符串
   */
  static toISOString(timestamp: number | Date): string {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
    return date.toISOString()
  }
}

export const time = TimeUtil