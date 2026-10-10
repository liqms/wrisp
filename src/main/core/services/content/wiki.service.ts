
import { conceptDao } from "@/main/core/db/concept.dao";
import { topicDao } from "@/main/core/db/topic.dao";
import { topicChunkDao } from "@/main/core/db/topicChunk.dao";
import { topicConceptDao } from "@/main/core/db/topicConcept.dao";
import { conceptChunkDao } from "@/main/core/db/conceptChunk.dao";
import { ChunkDao } from "@/main/core/db/chunk.dao";
import { projectDao } from "@/main/core/db/project.dao";
import { FileIndexDao } from "@/main/core/db/fileIndex.dao";
import type {
  WikiOverview,
  WikiOverviewStats,
  WikiConceptSummary,
  WikiTopicSummary,
  WikiPendingCount,
  ConceptCard,
  TopicCard,
} from "@/shared/types";
import { Logger } from "@/main/utils/logger";

const TOP_LIMIT = 10;

const chunkDao = new ChunkDao();
const fileIndexDao = new FileIndexDao();

class WikiService {
  private static instance: WikiService;

  private constructor() { }

  public static getInstance(): WikiService {
    if (!WikiService.instance) {
      WikiService.instance = new WikiService();
    }
    return WikiService.instance;
  }

  /** 获取 Wiki 概览数据 */
  public getOverview(): WikiOverview {
    const stats = this.getStats();
    const recentConcepts = this.getRecentConcepts();
    const recentTopics = this.getRecentTopics();
    return { stats, recentConcepts, recentTopics };
  }

  /** 知识统计 */
  private getStats(): WikiOverviewStats {
    let journalCount = 0;
    let chunkCount = 0;
    let conceptCount = 0;
    let topicCount = 0;
    let projectCount = 0;

    try {
      journalCount = fileIndexDao.count(
        "SELECT * FROM file_index WHERE file_path LIKE 'journal/%'",
      );
    } catch (e) {
      Logger.warn("统计日志数失败", { error: String(e) });
    }

    try {
      chunkCount = chunkDao.count(
        "SELECT * FROM semantic_chunks WHERE status = 'active'",
      );
    } catch (e) {
      Logger.warn("统计语义块数失败", { error: String(e) });
    }

    try {
      conceptCount = conceptDao.count();
    } catch (e) {
      Logger.warn("统计概念数失败", { error: String(e) });
    }

    try {
      topicCount = topicDao.countByStatus("active");
    } catch (e) {
      Logger.warn("统计主题数失败", { error: String(e) });
    }

    try {
      projectCount = projectDao.count(
        "SELECT * FROM projects WHERE status = 'active'",
      );
    } catch (e) {
      Logger.warn("统计作品数失败", { error: String(e) });
    }

    return { journalCount, chunkCount, conceptCount, topicCount, projectCount };
  }

  /** 近期新增概念 Top10 */
  private getRecentConcepts(): WikiConceptSummary[] {
    try {
      const result = conceptDao.paginate({
        page: 1,
        pageSize: TOP_LIMIT,
        orderBy: "created_at",
        orderDir: "DESC",
      });
      return result.data.map((c) => ({
        id: c.id,
        title: c.title,
        blockCount: conceptChunkDao.countBy("concept_id", c.id),
        createdAt: c.created_at,
      }));
    } catch (e) {
      Logger.warn("查询近期概念失败", { error: String(e) });
      return [];
    }
  }

  /** 近期更新主题 Top10 */
  private getRecentTopics(): WikiTopicSummary[] {
    try {
      const topics = topicDao.findByStatus("active", "updated_at");
      return topics.slice(0, TOP_LIMIT).map((t) => ({
        id: t.id,
        title: t.title,
        blockCount: topicChunkDao.countBy("topic_id", t.id),
        conceptCount: topicConceptDao.countBy("topic_id", t.id),
        updatedAt: t.updated_at,
      }));
    } catch (e) {
      Logger.warn("查询近期主题失败", { error: String(e) });
      return [];
    }
  }

  /** 待整理资源数 */
  public getPendingCount(): WikiPendingCount {
    try {
      // 以「摘要阶段还没跑过这块」为待整理判据，与 chunk-summary 的选取条件同形。
      // 不能用 ai_summary 是否为空：无正文可摘要的块（代码 / 围栏 / 纯图片）永远没有
      // 摘要，会被一直算成待整理；last_smart_processed_at 则是多任务共写的观测列，用它计数会漏。
      const pendingChunks = chunkDao.count(
        "SELECT * FROM semantic_chunks WHERE status = 'active' AND (last_summary_generated_at IS NULL OR updated_at > last_summary_generated_at)",
      );
      return { pendingChunks };
    } catch (e) {
      Logger.warn("查询待整理资源数失败", { error: String(e) });
      return { pendingChunks: 0 };
    }
  }

  /** 概念卡片列表 */
  public listConceptCards(params: {
    keyword?: string;
    orderBy?: string;
    orderDir?: "ASC" | "DESC";
    page?: number;
    pageSize?: number;
  }): { data: ConceptCard[]; total: number } {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;

    let concepts;
    let total: number;

    if (params.keyword && params.keyword.trim()) {
      concepts = conceptDao.searchFts(params.keyword.trim(), pageSize);
      total = concepts.length;
    } else {
      const result = conceptDao.paginate({
        page,
        pageSize,
        orderBy: params.orderBy ?? "relevance",
        orderDir: params.orderDir ?? "DESC",
      });
      concepts = result.data;
      total = result.total;
    }

    const data: ConceptCard[] = concepts.map((c) => ({
      id: c.id,
      title: c.title,
      evolvingSummary: c.evolving_summary,
      relevance: c.relevance,
      blockCount: conceptChunkDao.countBy("concept_id", c.id),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));

    return { data, total };
  }

  /** 主题卡片列表 */
  public listTopicCards(params: {
    keyword?: string;
    orderBy?: string;
    orderDir?: "ASC" | "DESC";
    page?: number;
    pageSize?: number;
  }): { data: TopicCard[]; total: number } {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const offset = (page - 1) * pageSize;

    let topics;
    let total: number;

    if (params.keyword && params.keyword.trim()) {
      topics = topicDao.searchFts(params.keyword.trim(), pageSize);
      total = topics.length;
    } else {
      topics = topicDao.findByStatus("active", "updated_at");
      total = topics.length;
      if (params.orderBy === "title") {
        topics.sort((a, b) => a.title.localeCompare(b.title));
      }
      topics = topics.slice(offset, offset + pageSize);
    }

    const data: TopicCard[] = topics.map((t) => ({
      id: t.id,
      title: t.title,
      summary: t.summary,
      status: t.status,
      blockCount: topicChunkDao.countBy("topic_id", t.id),
      conceptCount: topicConceptDao.countBy("topic_id", t.id),
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    return { data, total };
  }

  /** 更新主题 */
  public updateTopic(id: string, data: { title?: string; summary?: string }): boolean {
    try {
      const updates: Record<string, unknown> = {};
      if (data.title !== undefined) updates.title = data.title;
      if (data.summary !== undefined) updates.summary = data.summary;
      if (Object.keys(updates).length === 0) return true;

      updates.updated_at = new Date().toISOString();
      topicDao.update(id, updates);
      return true;
    } catch (e) {
      Logger.error("更新主题失败", { error: String(e), id });
      return false;
    }
  }

  /** 软删除主题 */
  public deleteTopic(id: string): boolean {
    try {
      topicDao.updateStatus(id, "deleted");
      return true;
    } catch (e) {
      Logger.error("删除主题失败", { error: String(e), id });
      return false;
    }
  }
}

export default WikiService;

export const wikiService = WikiService.getInstance();
