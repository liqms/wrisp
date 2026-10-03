// AI生成
import { chunkService } from "@/main/core/services/content/chunk.service";
import { conceptDao } from "@/main/core/db/concept.dao";
import { topicDao } from "@/main/core/db/topic.dao";
import { projectDao } from "@/main/core/db/project.dao";
import { pageDao } from "@/main/core/db/page.dao";
import { SEARCH_TYPE } from "@/shared/enums";
import type { SearchResult } from "@/shared/types";
import { Logger } from "@/main/utils/logger";

const DEFAULT_LIMIT = 20;
const SNIPPET_LENGTH = 120;

function makeSnippet(text: string | null | undefined): string {
  if (!text) return "";
  return text.length > SNIPPET_LENGTH
    ? text.slice(0, SNIPPET_LENGTH) + "…"
    : text;
}

/**
 * 全局搜索服务
 * 提供向量搜索 + FTS5 兜底搜索功能
 */
class SearchService {
  private static instance: SearchService;

  private constructor() {}

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
  public async search(keyword: string, limit?: number): Promise<SearchResult[]> {
    if (!keyword || keyword.trim() === "") return [];
    const max = limit ?? DEFAULT_LIMIT;

    try {
      return await this.vectorSearch(keyword, max);
    } catch (error) {
      Logger.warn("向量搜索失败，回退到文本搜索", { error: String(error) });
      return this.textSearch(keyword, max);
    }
  }

  /**
   * 向量搜索
   * 语义块使用向量语义搜索，其余 4 类使用 FTS5 全文搜索
   */
  public async vectorSearch(keyword: string, limit: number = DEFAULT_LIMIT): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // 1. 语义块：向量语义搜索（全库，不按作品隔离）
    //    若向量搜索返回空结果（未抛异常但无命中），降级到 FTS5 全文搜索
    try {
      const chunks = await chunkService.searchAll(keyword, limit, SEARCH_TYPE.SEMANTIC);
      if (chunks.length > 0) {
        for (const c of chunks) {
          results.push({
            type: "chunk",
            id: c.id,
            title: makeSnippet(c.content),
            content: c.ai_summary ?? makeSnippet(c.content),
            createdAt: c.created_at,
            updatedAt: c.updated_at,
          });
        }
      } else {
        // 向量搜索无命中，降级 FTS5
        const ftsChunks = await chunkService.searchAll(keyword, limit, SEARCH_TYPE.KEYWORD);
        for (const c of ftsChunks) {
          results.push({
            type: "chunk",
            id: c.id,
            title: makeSnippet(c.content),
            content: c.ai_summary ?? makeSnippet(c.content),
            createdAt: c.created_at,
            updatedAt: c.updated_at,
          });
        }
      }
    } catch (error) {
      Logger.warn("语义块向量搜索失败，降级为 FTS5", { error: String(error) });
      const chunks = await chunkService.searchAll(keyword, limit, SEARCH_TYPE.KEYWORD);
      for (const c of chunks) {
        results.push({
          type: "chunk",
          id: c.id,
          title: makeSnippet(c.content),
          content: c.ai_summary ?? makeSnippet(c.content),
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        });
      }
    }

    // 2-5. 概念/主题/作品/页面：FTS5 全文搜索
    this.addConceptResults(results, keyword, limit);
    this.addTopicResults(results, keyword, limit);
    this.addProjectResults(results, keyword, limit);
    this.addPageResults(results, keyword, limit);

    return results;
  }

  /**
   * 文本搜索 (FTS5)
   * 全部 5 类数据源均使用 FTS5 全文搜索
   */
  public async textSearch(keyword: string, limit: number = DEFAULT_LIMIT): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // 1. 语义块
    const chunks = await chunkService.searchAll(keyword, limit, SEARCH_TYPE.KEYWORD);
    for (const c of chunks) {
      results.push({
        type: "chunk",
        id: c.id,
        title: makeSnippet(c.content),
        content: c.ai_summary ?? makeSnippet(c.content),
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      });
    }

    // 2-5. 概念/主题/作品/页面
    this.addConceptResults(results, keyword, limit);
    this.addTopicResults(results, keyword, limit);
    this.addProjectResults(results, keyword, limit);
    this.addPageResults(results, keyword, limit);

    return results;
  }

  private addConceptResults(results: SearchResult[], query: string, limit: number): void {
    try {
      const concepts = conceptDao.searchFts(query, limit);
      for (const c of concepts) {
        results.push({
          type: "concept",
          id: c.id,
          title: c.title,
          content: makeSnippet(c.evolving_summary),
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        });
      }
    } catch (error) {
      Logger.warn("概念 FTS5 搜索失败", { error: String(error), query });
    }
  }

  private addTopicResults(results: SearchResult[], query: string, limit: number): void {
    try {
      const topics = topicDao.searchFts(query, limit);
      for (const t of topics) {
        results.push({
          type: "topic",
          id: t.id,
          title: t.title,
          content: makeSnippet(t.summary),
          createdAt: t.created_at,
          updatedAt: t.updated_at,
        });
      }
    } catch (error) {
      Logger.warn("主题 FTS5 搜索失败", { error: String(error), query });
    }
  }

  private addProjectResults(results: SearchResult[], query: string, limit: number): void {
    try {
      const projects = projectDao.searchFts(query, limit);
      for (const p of projects) {
        results.push({
          type: "project",
          id: p.id,
          title: p.name,
          content: makeSnippet(p.description) || makeSnippet(p.ai_summary),
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        });
      }
    } catch (error) {
      Logger.warn("作品 FTS5 搜索失败", { error: String(error), query });
    }
  }

  private addPageResults(results: SearchResult[], query: string, limit: number): void {
    try {
      const pages = pageDao.searchFts(query, limit);
      for (const p of pages) {
        results.push({
          type: "page",
          id: p.id,
          title: p.title,
          content: makeSnippet(p.ai_summary) || makeSnippet(p.content),
          createdAt: p.created_at,
          updatedAt: p.updated_at,
          projectId: p.project_id ?? undefined,
          pageType: p.page_type,
        });
      }
    } catch (error) {
      Logger.warn("页面 FTS5 搜索失败", { error: String(error), query });
    }
  }
}

export default SearchService;

export const searchService = SearchService.getInstance();
