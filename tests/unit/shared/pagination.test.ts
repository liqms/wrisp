import { describe, it, expect } from 'vitest'
import { paginate, paginateWithFilter, paginateWithSort, paginateWithFilterAndSort, createPaginator } from '@/shared/utils/pagination'
import type { PaginationResult } from '@/shared/utils/pagination'

const sampleData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

describe('paginate', () => {
  it('should return first page by default', () => {
    const result = paginate(sampleData)
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(50)
    expect(result.data).toEqual(sampleData)
    expect(result.total).toBe(10)
  })

  it('should paginate correctly with custom page and pageSize', () => {
    const result = paginate(sampleData, { page: 1, pageSize: 3 })
    expect(result.data).toEqual([1, 2, 3])
    expect(result.total).toBe(10)
    expect(result.totalPages).toBe(4)
    expect(result.hasNext).toBe(true)
    expect(result.hasPrev).toBe(false)
    expect(result.startIndex).toBe(0)
    expect(result.endIndex).toBe(3)
  })

  it('should return correct last page', () => {
    const result = paginate(sampleData, { page: 4, pageSize: 3 })
    expect(result.data).toEqual([10])
    expect(result.page).toBe(4)
    expect(result.hasNext).toBe(false)
    expect(result.hasPrev).toBe(true)
  })

  it('should cap pageSize at 100', () => {
    const result = paginate(sampleData, { pageSize: 200 })
    expect(result.pageSize).toBe(100)
  })

  it('should ensure page is at least 1', () => {
    const result = paginate(sampleData, { page: 0 })
    expect(result.page).toBe(1)

    const result2 = paginate(sampleData, { page: -5 })
    expect(result2.page).toBe(1)
  })

  it('should handle empty data', () => {
    const result = paginate([])
    expect(result.data).toEqual([])
    expect(result.total).toBe(0)
    expect(result.totalPages).toBe(0)
    expect(result.hasNext).toBe(false)
    expect(result.hasPrev).toBe(false)
  })
})

describe('paginateWithFilter', () => {
  it('should filter then paginate', () => {
    const result = paginateWithFilter(
      sampleData,
      (n) => n > 5,
      { pageSize: 3 }
    )
    expect(result.data).toEqual([6, 7, 8])
    expect(result.total).toBe(5)
  })
})

describe('paginateWithSort', () => {
  it('should sort then paginate', () => {
    const result = paginateWithSort(
      sampleData,
      (a, b) => b - a,
      { pageSize: 3 }
    )
    expect(result.data).toEqual([10, 9, 8])
    expect(result.total).toBe(10)
  })
})

describe('paginateWithFilterAndSort', () => {
  it('should filter, sort, then paginate', () => {
    const result = paginateWithFilterAndSort(
      sampleData,
      (n) => n > 5,
      (a, b) => b - a,
      { pageSize: 2 }
    )
    expect(result.data).toEqual([10, 9])
    expect(result.total).toBe(5)
  })
})

describe('createPaginator / Paginator', () => {
  it('should support chained filter and sort', () => {
    const result = createPaginator(sampleData)
      .filter((n) => n % 2 === 0)
      .sort((a, b) => b - a)
      .get({ pageSize: 2 })

    expect(result.data).toEqual([10, 8])
    expect(result.total).toBe(5)
  })

  it('should support shorthand methods', () => {
    const r1 = createPaginator(sampleData).paginate({ pageSize: 3 })
    expect(r1.data).toHaveLength(3)

    const r2 = createPaginator(sampleData).filterAndPaginate((n) => n > 7, { pageSize: 2 })
    expect(r2.data).toEqual([8, 9])
  })
})

