/**
 * 通用分页工具函数
 * 提供对任何数组数据进行分页的功能
 */

/**
 * 分页结果接口
 */
export interface PaginationResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
  startIndex: number
  endIndex: number
}

/**
 * 分页选项接口
 */
export interface PaginationOptions {
  page?: number
  pageSize?: number
}

/**
 * 通用分页函数
 * 对任意数组数据进行分页处理
 * @param data - 要分页的数据数组
 * @param options - 分页选项
 * @param options.page - 页码（从 1 开始），默认 1
 * @param options.pageSize - 每页记录数，默认 50，最大 100
 * @returns 分页结果对象
 */
export function paginate<T>(
  data: T[], 
  options: PaginationOptions = {}
): PaginationResult<T> {
  // 参数验证和默认值
  const page = Math.max(1, options.page || 1)
  const pageSize = Math.min(Math.max(1, options.pageSize || 50), 100)
  
  const total = data.length
  const totalPages = Math.ceil(total / pageSize)
  
  // 计算分页索引
  const startIndex = (page - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, total)
  
  // 获取当前页数据
  const paginatedData = data.slice(startIndex, endIndex)
  
  // 分页状态
  const hasNext = page < totalPages
  const hasPrev = page > 1
  
  return {
    data: paginatedData,
    total,
    page,
    pageSize,
    totalPages,
    hasNext,
    hasPrev,
    startIndex,
    endIndex
  }
}

/**
 * 带过滤条件的分页函数
 * 先对数据进行过滤，然后进行分页
 * @param data - 要分页的数据数组
 * @param filterFn - 过滤函数
 * @param options - 分页选项
 * @returns 分页结果对象
 */
export function paginateWithFilter<T>(
  data: T[],
  filterFn: (item: T) => boolean,
  options: PaginationOptions = {}
): PaginationResult<T> {
  const filteredData = data.filter(filterFn)
  return paginate(filteredData, options)
}

/**
 * 带排序的分页函数
 * 先对数据进行排序，然后进行分页
 * @param data - 要分页的数据数组
 * @param sortFn - 排序函数
 * @param options - 分页选项
 * @returns 分页结果对象
 */
export function paginateWithSort<T>(
  data: T[],
  sortFn: (a: T, b: T) => number,
  options: PaginationOptions = {}
): PaginationResult<T> {
  const sortedData = [...data].sort(sortFn)
  return paginate(sortedData, options)
}

/**
 * 带过滤和排序的分页函数
 * 先过滤再排序，然后进行分页
 * @param data - 要分页的数据数组
 * @param filterFn - 过滤函数
 * @param sortFn - 排序函数
 * @param options - 分页选项
 * @returns 分页结果对象
 */
export function paginateWithFilterAndSort<T>(
  data: T[],
  filterFn: (item: T) => boolean,
  sortFn: (a: T, b: T) => number,
  options: PaginationOptions = {}
): PaginationResult<T> {
  const filteredData = data.filter(filterFn)
  const sortedData = [...filteredData].sort(sortFn)
  return paginate(sortedData, options)
}

/**
 * 分页工具类（面向对象方式）
 */
export class Paginator<T> {
  private data: T[]
  
  constructor(data: T[]) {
    this.data = data
  }
  
  /**
   * 基本分页
   */
  paginate(options: PaginationOptions = {}): PaginationResult<T> {
    return paginate(this.data, options)
  }
  
  /**
   * 带过滤的分页
   */
  filterAndPaginate(
    filterFn: (item: T) => boolean,
    options: PaginationOptions = {}
  ): PaginationResult<T> {
    return paginateWithFilter(this.data, filterFn, options)
  }
  
  /**
   * 带排序的分页
   */
  sortAndPaginate(
    sortFn: (a: T, b: T) => number,
    options: PaginationOptions = {}
  ): PaginationResult<T> {
    return paginateWithSort(this.data, sortFn, options)
  }
  
  /**
   * 带过滤和排序的分页
   */
  filterSortAndPaginate(
    filterFn: (item: T) => boolean,
    sortFn: (a: T, b: T) => number,
    options: PaginationOptions = {}
  ): PaginationResult<T> {
    return paginateWithFilterAndSort(this.data, filterFn, sortFn, options)
  }
  
  /**
   * 链式调用支持
   */
  filter(filterFn: (item: T) => boolean): Paginator<T> {
    this.data = this.data.filter(filterFn)
    return this
  }
  
  sort(sortFn: (a: T, b: T) => number): Paginator<T> {
    this.data = [...this.data].sort(sortFn)
    return this
  }
  
  get(options: PaginationOptions = {}): PaginationResult<T> {
    return paginate(this.data, options)
  }
}

/**
 * 创建分页器实例的快捷函数
 */
export function createPaginator<T>(data: T[]): Paginator<T> {
  return new Paginator(data)
}