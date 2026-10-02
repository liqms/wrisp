import { TopicDao, TopicChunkDao, TopicConceptDao, ConceptDao, ChunkDao } from "@/main/core/db";
import type {
  Topic,
  TopicWithConceptsAndBlocks,
  ConceptSummary,
  BlockSummary,
} from "@/main/types/db";
import { PaginationResult } from "@/shared/utils/pagination";
import { Logger } from "@/main/utils/logger";

class TopicService {
  private static instance: TopicService | null = null;
  private topicDao: TopicDao;
  private topicChunkDao: TopicChunkDao;
  private topicConceptDao: TopicConceptDao;
  private conceptDao: ConceptDao;
  private chunkDao: ChunkDao;

  private constructor() {
    this.topicDao = new TopicDao();
    this.topicChunkDao = new TopicChunkDao();
    this.topicConceptDao = new TopicConceptDao();
    this.conceptDao = new ConceptDao();
    this.chunkDao = new ChunkDao();
  }

  public static getInstance(): TopicService {
    if (!TopicService.instance) {
      TopicService.instance = new TopicService();
    }
    return TopicService.instance;
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
      const topicChunks = this.topicChunkDao.findBy("topic_id", id);
      const blockIds = topicChunks.map((tb) => tb.chunk_id);
      const blocks: BlockSummary[] = [];
      if (blockIds.length > 0) {
        const blockRecords = this.chunkDao.findByIds(blockIds);
        for (const tb of topicChunks) {
          const b = blockRecords.find((bl) => bl.id === tb.chunk_id);
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
        block_count: topicChunks.length,
        concept_count: topicConcepts.length,
        concepts,
        blocks,
      };
    } catch (error) {
      Logger.error("获取主题详情失败", { error: String(error), id });
      throw error;
    }
  }
}

export default TopicService;
export const topicService = TopicService.getInstance();