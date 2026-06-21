import { describe, it, expect } from 'vitest'
import { ObjectUtil, objectUtil } from '@/shared/utils/object'

describe('ObjectUtil', () => {
  describe('get', () => {
    const obj = { a: { b: { c: 42 } }, x: null }

    it('should get nested value by dot-separated path', () => {
      expect(ObjectUtil.get(obj, 'a.b.c')).toBe(42)
    })

    it('should get nested value by array path', () => {
      expect(ObjectUtil.get(obj, ['a', 'b', 'c'])).toBe(42)
    })

    it('should return undefined for missing path', () => {
      expect(ObjectUtil.get(obj, 'a.b.z')).toBeUndefined()
    })

    it('should return default value for missing path', () => {
      expect(ObjectUtil.get(obj, 'a.b.z', 'fallback')).toBe('fallback')
    })

    it('should handle null mid-path', () => {
      expect(ObjectUtil.get(obj, 'x.y')).toBeUndefined()
    })
  })

  describe('set', () => {
    it('should set nested value by path and return a new object', () => {
      const obj = { a: { b: 1 } }
      const result = ObjectUtil.set(obj, 'a.b', 99)
      expect(result).toEqual({ a: { b: 99 } })
      expect(result).not.toBe(obj)
    })

    it('should create intermediate objects', () => {
      const obj = {} as Record<string, unknown>
      const result = ObjectUtil.set(obj, 'x.y.z', true)
      expect(result).toEqual({ x: { y: { z: true } } })
    })
  })

  describe('has', () => {
    it('should return true for existing nested path', () => {
      expect(ObjectUtil.has({ a: { b: 1 } }, 'a.b')).toBe(true)
    })

    it('should return false for missing path', () => {
      expect(ObjectUtil.has({ a: { b: 1 } }, 'a.c')).toBe(false)
    })

    it('should return false when mid-path is null', () => {
      expect(ObjectUtil.has({ a: null }, 'a.b')).toBe(false)
    })
  })

  describe('deepClone', () => {
    it('should deeply clone a plain object', () => {
      const original = { a: 1, b: { c: [1, 2, 3] } }
      const cloned = ObjectUtil.deepClone(original)
      expect(cloned).toEqual(original)
      expect(cloned).not.toBe(original)
      expect(cloned.b).not.toBe(original.b)
      expect(cloned.b.c).not.toBe(original.b.c)
    })

    it('should clone arrays', () => {
      expect(ObjectUtil.deepClone([1, [2, 3]])).toEqual([1, [2, 3]])
    })

    it('should clone Date objects', () => {
      const date = new Date('2024-01-01')
      const cloned = ObjectUtil.deepClone(date)
      expect(cloned).toEqual(date)
      expect(cloned).not.toBe(date)
    })

    it('should clone Map objects', () => {
      const map = new Map([['key', 'value']])
      const cloned = ObjectUtil.deepClone(map)
      expect(cloned.get('key')).toBe('value')
      expect(cloned).not.toBe(map)
    })

    it('should clone Set objects', () => {
      const set = new Set([1, 2, 3])
      const cloned = ObjectUtil.deepClone(set)
      expect(cloned.has(1)).toBe(true)
      expect(cloned).not.toBe(set)
    })

    it('should return primitives as-is', () => {
      expect(ObjectUtil.deepClone(42)).toBe(42)
      expect(ObjectUtil.deepClone('hello')).toBe('hello')
      expect(ObjectUtil.deepClone(null)).toBeNull()
    })
  })

  describe('deepMerge', () => {
    it('should deep merge multiple sources', () => {
      const result = ObjectUtil.deepMerge(
        { a: 1, b: { x: 1 } },
        { b: { y: 2 } },
        { c: 3 }
      )
      expect(result).toEqual({ a: 1, b: { x: 1, y: 2 }, c: 3 })
    })
  })

  describe('deepEquals', () => {
    it('should return true for deeply equal objects', () => {
      expect(ObjectUtil.deepEquals({ a: 1, b: [2, 3] }, { a: 1, b: [2, 3] })).toBe(true)
    })

    it('should return false for different objects', () => {
      expect(ObjectUtil.deepEquals({ a: 1 }, { a: 2 })).toBe(false)
    })

    it('should return true for same reference', () => {
      const obj = { a: 1 }
      expect(ObjectUtil.deepEquals(obj, obj)).toBe(true)
    })

    it('should handle arrays of different lengths', () => {
      expect(ObjectUtil.deepEquals([1, 2], [1, 2, 3])).toBe(false)
    })
  })

  describe('pick', () => {
    it('should pick specified keys', () => {
      expect(ObjectUtil.pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 })
    })
  })

  describe('omit', () => {
    it('should omit specified keys', () => {
      expect(ObjectUtil.omit({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 })
    })
  })
})

describe('objectUtil alias', () => {
  it('should be an alias of ObjectUtil', () => {
    expect(objectUtil.deepClone({ a: 1 })).toEqual({ a: 1 })
  })
})

