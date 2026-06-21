import { describe, it, expect } from 'vitest'
import {
  validateId,
  validateString,
  validateFilePath,
  validateFileExtension,
  validateNumberRange,
  validateBoolean,
  validateArray,
  sanitizeOrderBy,
  validateEmail,
  validateUrl,
  validateDateString,
  validateAll,
  validateWithMessages,
} from '@/shared/utils/validate'

describe('validateId', () => {
  it('should return true for valid positive integers', () => {
    expect(validateId(1)).toBe(true)
    expect(validateId(999)).toBe(true)
    expect(validateId(Number.MAX_SAFE_INTEGER)).toBe(true)
  })

  it('should return false for undefined or null', () => {
    expect(validateId(undefined)).toBe(false)
    expect(validateId(null as unknown as number)).toBe(false)
  })

  it('should return false for non-positive integers', () => {
    expect(validateId(0)).toBe(false)
    expect(validateId(-1)).toBe(false)
  })

  it('should return false for non-integers', () => {
    expect(validateId(1.5)).toBe(false)
    expect(validateId(NaN)).toBe(false)
  })
})

describe('validateString', () => {
  it('should return true for valid strings', () => {
    expect(validateString('hello')).toBe(true)
    expect(validateString('a')).toBe(true)
  })

  it('should return false for undefined or null', () => {
    expect(validateString(undefined)).toBe(false)
    expect(validateString(null as unknown as string)).toBe(false)
  })

  it('should return true for trimmed strings meeting min length', () => {
    expect(validateString('  hello  ')).toBe(true)
  })

  it('should return false for empty or whitespace-only strings', () => {
    expect(validateString('')).toBe(false)
    expect(validateString('   ')).toBe(false)
  })

  it('should respect custom min/max length', () => {
    expect(validateString('ab', 'test', 3)).toBe(false)
    expect(validateString('abc', 'test', 3)).toBe(true)
    expect(validateString('toolongstring', 'test', 1, 5)).toBe(false)
  })
})

describe('validateFilePath', () => {
  it('should return true for valid paths', () => {
    expect(validateFilePath('/home/user/file.txt')).toBe(true)
    expect(validateFilePath('./relative/path')).toBe(true)
    expect(validateFilePath('data/file.log')).toBe(true)
  })

  it('should return false for paths with invalid characters', () => {
    expect(validateFilePath('file<>name.txt')).toBe(false)
    expect(validateFilePath('file|name.txt')).toBe(false)
    expect(validateFilePath('file?name.txt')).toBe(false)
    expect(validateFilePath('C:\\path\\file.txt')).toBe(false)
  })

  it('should return false for undefined or empty', () => {
    expect(validateFilePath(undefined)).toBe(false)
  })
})

describe('validateFileExtension', () => {
  it('should return true for valid extensions', () => {
    expect(validateFileExtension('txt')).toBe(true)
    expect(validateFileExtension('tar.gz')).toBe(true)
    expect(validateFileExtension('JSON')).toBe(true)
    expect(validateFileExtension('Tsx')).toBe(true)
  })

  it('should return false for invalid extensions', () => {
    expect(validateFileExtension('.txt')).toBe(false)
    expect(validateFileExtension('')).toBe(false)
    expect(validateFileExtension(undefined)).toBe(false)
    expect(validateFileExtension('verylongextensionnamehere!')).toBe(false)
  })
})

describe('validateNumberRange', () => {
  it('should return true for numbers in range', () => {
    expect(validateNumberRange(5)).toBe(true)
    expect(validateNumberRange(0, 'test', 0)).toBe(true)
    expect(validateNumberRange(50, 'test', 0, 100)).toBe(true)
  })

  it('should return false for undefined or null', () => {
    expect(validateNumberRange(undefined)).toBe(false)
  })

  it('should return false for out-of-range numbers', () => {
    expect(validateNumberRange(-1, 'test', 0)).toBe(false)
    expect(validateNumberRange(101, 'test', 0, 100)).toBe(false)
    expect(validateNumberRange(Infinity)).toBe(false)
  })
})

describe('validateBoolean', () => {
  it('should return true for boolean values', () => {
    expect(validateBoolean(true)).toBe(true)
    expect(validateBoolean(false)).toBe(true)
  })

  it('should return false for non-boolean or undefined', () => {
    expect(validateBoolean(undefined)).toBe(false)
    expect(validateBoolean(null as unknown as boolean)).toBe(false)
  })
})

describe('validateArray', () => {
  it('should return true for valid arrays', () => {
    expect(validateArray([1, 2, 3])).toBe(true)
    expect(validateArray([])).toBe(true)
  })

  it('should return false for undefined or non-arrays', () => {
    expect(validateArray(undefined)).toBe(false)
    expect(validateArray(null as unknown as number[])).toBe(false)
  })

  it('should respect custom min/max length', () => {
    expect(validateArray(['a'], 2)).toBe(false)
    expect(validateArray(new Array(101), 0, 100)).toBe(false)
  })
})

describe('sanitizeOrderBy', () => {
  it('should return the column name if allowed', () => {
    expect(sanitizeOrderBy('name')).toBe('name')
    expect(sanitizeOrderBy('created_at')).toBe('created_at')
  })

  it('should return default for disallowed or invalid input', () => {
    expect(sanitizeOrderBy('password')).toBe('id')
    expect(sanitizeOrderBy('')).toBe('id')
    expect(sanitizeOrderBy(undefined)).toBe('id')
  })

  it('should strip unsafe characters', () => {
    expect(sanitizeOrderBy('name; DROP TABLE')).toBe('id')
  })
})

describe('validateEmail', () => {
  it('should return true for valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true)
    expect(validateEmail('a.b@c.co')).toBe(true)
    expect(validateEmail('user+tag@example.org')).toBe(true)
  })

  it('should return false for invalid emails', () => {
    expect(validateEmail('notanemail')).toBe(false)
    expect(validateEmail('@example.com')).toBe(false)
    expect(validateEmail('user@')).toBe(false)
    expect(validateEmail(undefined)).toBe(false)
  })
})

describe('validateUrl', () => {
  it('should return true for valid URLs', () => {
    expect(validateUrl('https://example.com')).toBe(true)
    expect(validateUrl('http://localhost:5173')).toBe(true)
    expect(validateUrl('ftp://files.example.com')).toBe(true)
  })

  it('should return false for invalid URLs', () => {
    expect(validateUrl('not a url')).toBe(false)
    expect(validateUrl(undefined)).toBe(false)
  })
})

describe('validateDateString', () => {
  it('should return true for valid date strings', () => {
    expect(validateDateString('2024-01-01')).toBe(true)
    expect(validateDateString('2024-01-01T00:00:00Z')).toBe(true)
  })

  it('should return false for invalid date strings', () => {
    expect(validateDateString('not a date')).toBe(false)
    expect(validateDateString(undefined)).toBe(false)
  })
})

describe('validateAll', () => {
  it('should return true when all validations pass', () => {
    expect(validateAll([
      () => true,
      () => true,
    ])).toBe(true)
  })

  it('should return false when any validation fails', () => {
    expect(validateAll([
      () => true,
      () => false,
    ])).toBe(false)
  })

  it('should return false for invalid input', () => {
    expect(validateAll(null as unknown as (() => boolean)[])).toBe(false)
  })
})

describe('validateWithMessages', () => {
  it('should return valid true when all pass', () => {
    const result = validateWithMessages([
      () => ({ valid: true }),
    ])
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('should collect error messages', () => {
    const result = validateWithMessages([
      () => ({ valid: false, message: 'Error 1' }),
      () => ({ valid: false, message: 'Error 2' }),
    ])
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(['Error 1', 'Error 2'])
  })

  it('should treat failures without message as valid (no errors collected)', () => {
    const result = validateWithMessages([
      () => ({ valid: true }),
      () => ({ valid: false }),
    ])
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('should handle invalid input', () => {
    const result = validateWithMessages(null as unknown as Array<() => { valid: boolean; message?: string }>)
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(1)
  })
})

