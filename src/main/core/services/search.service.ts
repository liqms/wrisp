/**
 * 全局搜索服务
 * 提供向量搜索 + FTS5 兜底搜索功能
 */
class SearchService {
  private static instance: SearchService;

  private constructor() { }

  public static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  /**
   * 执行搜索
   * 优先向量搜索，失败时回退到文本搜索
   */
  public async search(keyword: string, limit?: number): Promise<unknown[]> {
    try {
      return await this.vectorSearch(keyword, limit);
    } catch {
      return this.textSearch(keyword, limit);
    }
  }

  /**
   * 向量搜索
   */
  public async vectorSearch(_query: string, _limit?: number): Promise<unknown[]> {
    // TODO: 接入向量数据库搜索
    return [];
  }

  /**
   * 文本搜索 (FTS5)
   */
  public async textSearch(_keyword: string, _limit?: number): Promise<unknown[]> {
    // TODO: 接入 FTS5 全文搜索
    return [];
  }
}

export default SearchService;

export const searchService = SearchService.getInstance();