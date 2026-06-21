import { ConceptDao, ConceptBlockDao, TopicDao, TopicBlockDao, TopicConceptDao, ReflectionDao, ReflectionBlockDao, TemporalEventDao, BlockDao } from "@/main/core/db";
import type {
  Concept,
  ConceptWithBlocks,
  Topic,
  TopicWithConceptsAndBlocks,
  ConceptSummary,
  BlockSummary,
  Reflection,
  ReflectionWithBlocks,
  TemporalEventWithBlock,
} from "@/main/types/db";
import { PaginationResult } from "@/shared/utils/pagination";
import { Logger } from "@/main/utils/logger";

class ThinkService {
  private static instance: ThinkService | null = null;
  private conceptDao: ConceptDao;
  private conceptBlockDao: ConceptBlockDao;
  private topicDao: TopicDao;
  private topicBlockDao: TopicBlockDao;
  private topicConceptDao: TopicConceptDao;
  private reflectionDao: ReflectionDao;
  private reflectionBlockDao: ReflectionBlockDao;
  private temporalEventDao: TemporalEventDao;
  private blockDao: BlockDao;

  private constructor() {
    this.conceptDao = new ConceptDao();
    this.conceptBlockDao = new ConceptBlockDao();
    this.topicDao = new TopicDao();
    this.topicBlockDao = new TopicBlockDao();
    this.topicConceptDao = new TopicConceptDao();
    this.reflectionDao = new ReflectionDao();
    this.reflectionBlockDao = new ReflectionBlockDao();
    this.temporalEventDao = new TemporalEventDao();
    this.blockDao = new BlockDao();
  }

  public static getInstance(): ThinkService {
    if (!ThinkService.instance) {
      ThinkService.instance = new ThinkService();
    }
    return ThinkService.instance;
  }

  // ==================== 概念 ====================

  public paginateConcepts(params: {
    page?: number;
    pageSize?: number;
    orderBy?: string;
    orderDir?: "ASC" | "DESC";
    conditions?: Record<string, unknown>;
  }): PaginationResult<Concept> {
    try {
      return this.conceptDao.paginate(params);
    } catch (error) {
      Logger.error("分页查询概念失败", { error: String(error), params });
      throw error;
    }
  }

  public getConceptDetail(id: string): ConceptWithBlocks | null {
    try {
      const concept = this.conceptDao.findWithBlocks(id);
      if (!concept) return null;

      const conceptBlocks = this.conceptBlockDao.findBy("concept_id", id);
      const blockIds = conceptBlocks.map((cb) => cb.block_id);
      const blocks = blockIds.length > 0 ? this.blockDao.findByIds(blockIds) : [];

      return {
        ...concept,
        blocks: blocks.map((b) => ({
          id: b.id,
          content: b.content,
          relevance_score: conceptBlocks.find((cb) => cb.block_id === b.id)?.relevance_score || 0,
        })),
      } as ConceptWithBlocks;
    } catch (error) {
      Logger.error("获取概念详情失败", { error: String(error), id });
      throw error;
    }
  }

  // ==================== 主题 ====================

  public paginateTopics(params: {
    page?: number;
    pageSize?: number;
    orderBy?: string;
    orderDir?: "ASC" | "DESC";
    conditions?: Record<string, unknown>;
  }): PaginationResult<Topic> {
    try {
      return this.topicDao.paginate(params);
    } catch (error) {
      Logger.error("分页查询主题失败", { error: String(error), params });
      throw error;
    }
  }

  public getTopicDetail(id: string): TopicWithConceptsAndBlocks | null {
    try {
      const topic = this.topicDao.findById(id);
      if (!topic) return null;

      // 获取关联的概念列表
      const topicConcepts = this.topicConceptDao.findBy("topic_id", id);
      const conceptIds = topicConcepts.map((tc) => tc.concept_id);
      const concepts: ConceptSummary[] = [];
      if (conceptIds.length > 0) {
        const conceptRecords = this.conceptDao.findByIds(conceptIds);
        for (const tc of topicConcepts) {
          const c = conceptRecords.find((co) => co.id === tc.concept_id);
          if (c) {
            concepts.push({
              id: c.id,
              title: c.title,
              relevance: tc.relevance_score,
            });
          }
        }
      }

      // 获取关联的 block 列表
      const topicBlocks = this.topicBlockDao.findBy("topic_id", id);
      const blockIds = topicBlocks.map((tb) => tb.block_id);
      const blocks: BlockSummary[] = [];
      if (blockIds.length > 0) {
        const blockRecords = this.blockDao.findByIds(blockIds);
        for (const tb of topicBlocks) {
          const b = blockRecords.find((bl) => bl.id === tb.block_id);
          if (b) {
            blocks.push({
              id: b.id,
              content: b.content,
              relevance_score: tb.relevance_score,
            });
          }
        }
      }

      return {
        id: topic.id,
        title: topic.title,
        summary: topic.summary,
        status: topic.status,
        created_at: topic.created_at,
        updated_at: topic.updated_at,
        block_count: topicBlocks.length,
        concept_count: topicConcepts.length,
        concepts,
        blocks,
      };
    } catch (error) {
      Logger.error("获取主题详情失败", { error: String(error), id });
      throw error;
    }
  }

  // ==================== 反思 ====================

  public paginateReflections(params: {
    page?: number;
    pageSize?: number;
    orderBy?: string;
    orderDir?: "ASC" | "DESC";
    conditions?: Record<string, unknown>;
  }): PaginationResult<Reflection> {
    try {
      return this.reflectionDao.paginate(params);
    } catch (error) {
      Logger.error("分页查询反思失败", { error: String(error), params });
      throw error;
    }
  }

  public getReflectionDetail(id: string): ReflectionWithBlocks | null {
    try {
      const reflection = this.reflectionDao.findWithBlocks(id);
      if (!reflection) return null;

      const reflectionBlocks = this.reflectionBlockDao.findBy("reflection_id", id);
      const blockIds = reflectionBlocks.map((rb) => rb.block_id);
      const blocks = blockIds.length > 0 ? this.blockDao.findByIds(blockIds) : [];

      return {
        ...reflection,
        blocks: blocks.map((b) => ({
          id: b.id,
          content: b.content,
          relevance_score: reflectionBlocks.find((rb) => rb.block_id === b.id)?.relevance_score || 0,
        })),
      } as ReflectionWithBlocks;
    } catch (error) {
      Logger.error("获取反思详情失败", { error: String(error), id });
      throw error;
    }
  }

  // ==================== 时间事件 ====================

  public getTemporalEvents(
    startDate?: string,
    endDate?: string,
  ): TemporalEventWithBlock[] {
    try {
      let events;
      if (startDate && endDate) {
        const normalize = (d: string) =>
          /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00.000Z` : d;
        const s = normalize(startDate);
        const e = normalize(endDate);
        const sql = `SELECT te.*, b.content AS block_content FROM temporal_events te JOIN blocks b ON te.block_id = b.id WHERE te.created_at >= ? AND te.created_at <= ? ORDER BY te.created_at DESC`;
        events = this.temporalEventDao.query(sql, [s, e]) as TemporalEventWithBlock[];
      } else {
        events = this.temporalEventDao.getRecentEvents(20) as unknown as TemporalEventWithBlock[];
        // Enrich with block content
        if (events.length > 0) {
          const blockIds = events.map((e) => e.block_id);
          const blocks = this.blockDao.findByIds(blockIds);
          for (const evt of events) {
            const block = blocks.find((b) => b.id === evt.block_id);
            if (block) {
              evt.block_content = block.content;
            }
          }
        }
      }
      return events;
    } catch (error) {
      Logger.error("查询时间事件失败", { error: String(error), startDate, endDate });
      throw error;
    }
  }
}

export default ThinkService;
export const thinkService = ThinkService.getInstance();