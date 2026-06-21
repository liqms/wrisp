import { describe, it, expect } from 'vitest'
import { TimeUtil, time } from '@/shared/utils/time'

describe('TimeUtil', () => {
  describe('format', () => {
    it('should format date with default format', () => {
      const date = new Date(2024, 0, 1, 9, 5, 3)
      expect(TimeUtil.format(date)).toBe('2024-01-01 09:05:03')
    })

    it('should support custom format tokens', () => {
      const date = new Date(2024, 11, 25)
      expect(TimeUtil.format(date, 'YYYY/MM/DD')).toBe('2024/12/25')
    })

    it('should handle string input', () => {
      const result = TimeUtil.format('2024-06-15', 'YYYY-MM-DD')
      expect(result).toBe('2024-06-15')
    })
  })

  describe('getTimeDiff', () => {
    it('should compute absolute difference', () => {
      const start = new Date(2024, 0, 1)
      const end = new Date(2024, 0, 2)
      const diff = TimeUtil.getTimeDiff(start, end)
      expect(diff.days).toBe(1)
      expect(diff.hours).toBe(24)
    })
  })

  describe('getRelativeTime', () => {
    it('should return "刚刚" for very recent time', () => {
      const now = new Date()
      expect(TimeUtil.getRelativeTime(now, now)).toBe('刚刚')
    })

    it('should return seconds ago', () => {
      const past = new Date(Date.now() - 10000)
      expect(TimeUtil.getRelativeTime(past)).toMatch(/秒前/)
    })

    it('should return days ago for dates far apart', () => {
      const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      expect(TimeUtil.getRelativeTime(past)).toMatch(/天前/)
    })
  })

  describe('startOfDay / endOfDay', () => {
    it('should return start of day', () => {
      const d = TimeUtil.startOfDay(new Date(2024, 5, 15, 12, 30, 45))
      expect(d.getHours()).toBe(0)
      expect(d.getMinutes()).toBe(0)
      expect(d.getSeconds()).toBe(0)
    })

    it('should return end of day', () => {
      const d = TimeUtil.endOfDay(new Date(2024, 5, 15))
      expect(d.getHours()).toBe(23)
      expect(d.getMinutes()).toBe(59)
      expect(d.getSeconds()).toBe(59)
    })
  })

  describe('addTime', () => {
    it('should add days', () => {
      const d = TimeUtil.addTime(new Date(2024, 0, 1), 5, 'days')
      expect(d.getDate()).toBe(6)
    })

    it('should add months', () => {
      const d = TimeUtil.addTime(new Date(2024, 0, 1), 1, 'months')
      expect(d.getMonth()).toBe(1)
    })

    it('should add years', () => {
      const d = TimeUtil.addTime(new Date(2024, 0, 1), 1, 'years')
      expect(d.getFullYear()).toBe(2025)
    })
  })

  describe('isSameDay', () => {
    it('should return true for same day', () => {
      expect(TimeUtil.isSameDay(new Date(2024, 0, 1), new Date(2024, 0, 1))).toBe(true)
    })

    it('should return false for different days', () => {
      expect(TimeUtil.isSameDay(new Date(2024, 0, 1), new Date(2024, 0, 2))).toBe(false)
    })
  })

  describe('isWeekday / isWeekend', () => {
    // 2024-01-01 is Monday
    it('should identify Monday as weekday', () => {
      expect(TimeUtil.isWeekday(new Date(2024, 0, 1))).toBe(true)
      expect(TimeUtil.isWeekend(new Date(2024, 0, 1))).toBe(false)
    })

    // 2024-01-06 is Saturday
    it('should identify Saturday as weekend', () => {
      expect(TimeUtil.isWeekend(new Date(2024, 0, 6))).toBe(true)
      expect(TimeUtil.isWeekday(new Date(2024, 0, 6))).toBe(false)
    })
  })

  describe('now / today / currentTime', () => {
    it('should return current timestamp', () => {
      expect(TimeUtil.now()).toBeGreaterThan(0)
    })

    it('should return today date string', () => {
      expect(TimeUtil.today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should return current time string', () => {
      expect(TimeUtil.currentTime()).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    })
  })

  describe('toISOString', () => {
    it('should convert date to ISO string', () => {
      const date = new Date('2024-01-01T00:00:00.000Z')
      expect(TimeUtil.toISOString(date)).toBe('2024-01-01T00:00:00.000Z')
    })

    it('should convert timestamp to ISO string', () => {
      const ts = new Date('2024-06-15T12:00:00.000Z').getTime()
      expect(TimeUtil.toISOString(ts)).toMatch(/^2024-06-15/)
    })
  })
})

describe('time alias', () => {
  it('should be an alias of TimeUtil', () => {
    expect(time.format(new Date(2024, 0, 1))).toBe('2024-01-01 00:00:00')
  })
})

