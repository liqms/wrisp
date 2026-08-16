import { ConceptDao, ConceptChunkDao, TemporalEventDao, ChunkDao } from "@/main/core/db";
import type {
  Concept,
  ConceptWithBlocks,
  TemporalEventWithBlock,
} from "@/main/types/db";
import { PaginationResult } from "@/shared/utils/pagination";
import { Logger } from "@/main/utils/logger";

class ConceptService {
  private static instance: ConceptService | null = null;
  private conceptDao: ConceptDao;
  private conceptChunkDao: ConceptChunkDao;
  private temporalEventDao: TemporalEventDao;
  private chunkDao: ChunkDao;

  private constructor() {
    this.conceptDao = new ConceptDao();
    this.conceptChunkDao = new ConceptChunkDao();
    this.temporalEventDao = new TemporalEventDao();
    this.chunkDao = new ChunkDao();
  }

  public static getInstance(): ConceptService {
    if (!ConceptService.instance) {
      ConceptService.instance = new ConceptService();
    }
    return ConceptService.instance;
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

      const conceptChunks = this.conceptChunkDao.findBy("concept_id", id);
      const chunkIds = conceptChunks.map((cb) => cb.chunk_id);
      const blocks = chunkIds.length > 0 ? this.chunkDao.findByIds(chunkIds) : [];

      return {
        ...concept,
        blocks: blocks.map((b) => ({
          id: b.id,
          content: b.content,
          relevance_score: conceptChunks.find((cb) => cb.chunk_id === b.id)?.relevance_score || 0,
        })),
      } as ConceptWithBlocks;
    } catch (error) {
      Logger.error("获取概念详情失败", { error: String(error), id });
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
        const sql = `SELECT te.*, b.content AS chunk_content FROM temporal_events te JOIN semantic_chunks b ON te.chunk_id = b.id WHERE te.created_at >= ? AND te.created_at <= ? ORDER BY te.created_at DESC`;
        events = this.temporalEventDao.query(sql, [s, e]) as TemporalEventWithBlock[];
      } else {
        events = this.temporalEventDao.getRecentEvents(20) as unknown as TemporalEventWithBlock[];
        // Enrich with block content
        if (events.length > 0) {
          const blockIds = events.map((e) => e.chunk_id);
          const blocks = this.chunkDao.findByIds(blockIds);
          for (const evt of events) {
            const block = blocks.find((b) => b.id === evt.chunk_id);
            if (block) {
              evt.chunk_content = block.content;
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

export default ConceptService;
export const conceptService = ConceptService.getInstance();