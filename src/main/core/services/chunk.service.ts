import { Logger } from "@/main/utils/logger";
import {
  ChunkDao,
  ProjectChunkDao,
  ConceptChunkDao,
  TopicChunkDao,
} from "@/main/core/db";
import {
  type ChunkInfo,
  type ChunkCreate as SharedChunkCreate,
  type ChunkUpdate as SharedChunkUpdate,
  type ChunkQuery,
  type ChunkItem,
  type ChunkDateItem,
} from "@/shared/types/chunk.types";
import { Chunk, ChunkCreate } from "@/main/types/db";
import { Id } from "@/shared/types";
import { vectorService } from "./vector.service";
import { modelRouter } from "@/main/core/model-gateway/router";
import { SEARCH_TYPE, SearchType } from "@/shared/enums";
import { PaginationResult } from "@/shared/utils/pagination";
import { embed, rerank } from "@/main/core/model-gateway/local-gateway";

/**
 * Chunk 服务（语义块服务）
 * 提供 semantic_chunks 表的完整 CRUD 操作、项目关联、搜索
 * 被 JournalService 和 ProjectService 等上层服务调用
 */
class ChunkService {
  private static instance: ChunkService;
  private chunkDao: ChunkDao;
  private projectChunkDao: ProjectChunkDao;
  private conceptChunkDao: ConceptChunkDao;
  private topicChunkDao: TopicChunkDao;

  private constructor() {
    this.chunkDao = new ChunkDao();
    this.projectChunkDao = new ProjectChunkDao();
    this.conceptChunkDao = new ConceptChunkDao();
    this.topicChunkDao = new TopicChunkDao();
  }

  public static getInstance(): ChunkService {
    if (!ChunkService.instance) {
      ChunkService.instance = new ChunkService();
    }
    return ChunkService.instance;
  }

  // ──────── 类型转换 ────────

  public blockToChunkInfo(block: Chunk): ChunkInfo {
    const conceptCount = this.conceptChunkDao.countBy("chunk_id", block.id);
    const topicCount = this.topicChunkDao.countBy("chunk_id", block.id);

    return {
      id: block.id,
      content: block.content,
      project_id: null,
      ai_summary: block.ai_summary,
      temporal_score: block.temporal_score,
      word_count: block.word_count,
      status: block.status,
      concept_count: conceptCount,
      topic_count: topicCount,
      created_at: block.created_at,
      updated_at: block.updated_at,
    };
  }

  public blockToChunkItem(block: Chunk): ChunkItem {
    return {
      id: block.id,
      content: block.content,
      temporal_score: block.temporal_score,
      word_count: block.word_count,
      status: block.status,
      created_at: block.created_at,
      updated_at: block.updated_at,
    };
  }

  private blocksToRecordList(
    blocks: Chunk[],
    sortFn: (a: Chunk, b: Chunk) => number,
  ): ChunkInfo[] {
    return [...blocks].sort(sortFn).map((block) => this.blockToChunkInfo(block));
  }

  // ──────── 项目关联 ────────

  public syncProjectAssociation(blockId: Id, projectId?: Id | null): void {
    if (projectId === undefined) {
      return;
    }

    const existingProjectChunks = this.projectChunkDao.findBy(
      "chunk_id",
      blockId,
    );

    if (existingProjectChunks.length > 0) {
      const existingProjectId = existingProjectChunks[0].project_id;
      if (existingProjectId !== projectId) {
        this.projectChunkDao.deleteBy("project_id", existingProjectId, blockId);
      }
    }

    if (projectId) {
      this.projectChunkDao.addChunksToProject(projectId, [blockId]);
    }
  }

  // ──────── 创建语义块 ────────

  /**
   * 创建语义块（semantic_chunks 表）
   * @param journal 创建参数
   * @returns 创建的 block ID
   */
  public create(journal: SharedChunkCreate): string {
    try {
      const blockCreate: ChunkCreate = {
        content: journal.content,
        status: "active",
      };
      const createdBlockId = this.chunkDao.create(blockCreate);

      if (createdBlockId && journal.project_id) {
        this.projectChunkDao.addChunksToProject(journal.project_id, [
          createdBlockId,
        ]);
      }

      return createdBlockId;
    } catch (error) {
      Logger.error("创建语义块失败", { error: String(error), journal });
      throw error;
    }
  }

  // ──────── 查询详情 ────────

  public getById(id: Id): ChunkInfo | null {
    try {
      const block = this.chunkDao.findById(id);
      if (!block) {
        return null;
      }

      return this.blockToChunkInfo(block);
    } catch (error) {
      Logger.error("获取语义块详情失败", { error: String(error), id });
      throw error;
    }
  }

  // ──────── 更新语义块 ────────

  /**
   * 更新语义块
   * @returns 更新后的 block（可用于同步文件/索引表）
   */
  public update(journal: SharedChunkUpdate): Chunk | null {
    try {
      const existingBlock = this.chunkDao.findById(journal.id);
      if (!existingBlock) {
        return null;
      }

      const update: Partial<Chunk> = {};
      if (journal.content !== undefined) {
        update.content = journal.content;
      }
      this.chunkDao.update(existingBlock.id, update);
      this.syncProjectAssociation(existingBlock.id, journal.project_id);

      return this.chunkDao.findById(existingBlock.id);
    } catch (error) {
      Logger.error("更新语义块失败", { error: String(error), journal });
      return null;
    }
  }

  // ──────── 删除语义块 ────────

  /**
   * 删除语义块
   * @returns [是否成功, 被删除的 block（用于上层同步文件/索引表）]
   */
  public delete(id: Id): [boolean, Chunk | null] {
    try {
      const block = this.chunkDao.findById(id);
      if (!block) {
        return [false, null];
      }

      this.projectChunkDao.deleteBy("chunk_id", block.id);
      this.conceptChunkDao.deleteBy("chunk_id", block.id);
      this.topicChunkDao.deleteBy("chunk_id", block.id);
      const result = this.chunkDao.delete(block.id);
      return [result > 0, block];
    } catch (error) {
      Logger.error("删除语义块失败", { error: String(error), id });
      throw error;
    }
  }

  // ──────── 分页查询 ────────

  public list(query?: ChunkQuery): PaginationResult<ChunkItem> {
    try {
      const page = Math.max(1, query?.page ?? 1);
      const pageSize = Math.min(Math.max(1, query?.page_size ?? 50), 100);
      const offset = (page - 1) * pageSize;

      const conditions: string[] = [];
      const values: unknown[] = [];

      if (query?.temporal_score_min !== undefined) {
        conditions.push("temporal_score >= ?");
        values.push(query.temporal_score_min);
      }
      if (query?.temporal_score_max !== undefined) {
        conditions.push("temporal_score <= ?");
        values.push(query.temporal_score_max);
      }

      const whereClause = conditions.length > 0 ? conditions.join(" AND ") : "1=1";
      const countSql = `SELECT * FROM semantic_chunks WHERE ${whereClause}`;
      const total = this.chunkDao.count(countSql, values);

      const dataSql = `SELECT * FROM semantic_chunks WHERE ${whereClause} ORDER BY created_at ASC LIMIT ? OFFSET ?`;
      const dataValues = [...values, pageSize, offset];
      const blocks = this.chunkDao.query(dataSql, dataValues) as Chunk[];

      const totalPages = Math.ceil(total / pageSize);
      const startIndex = (page - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, total);

      return {
        data: blocks.map((block) => this.blockToChunkItem(block)),
        total,
        page,
        pageSize,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        startIndex,
        endIndex,
      };
    } catch (error) {
      Logger.error("分页查询语义块失败", { error: String(error), query });
      throw error;
    }
  }

  // ──────── 搜索 ────────

  public async search(
    keyword: string,
    limit: number = 50,
    searchType?: SearchType,
  ): Promise<ChunkItem[]> {
    try {
      if (searchType === SEARCH_TYPE.KEYWORD) {
        const blocks = this.chunkDao.searchFts(keyword, limit);
        return this.blocksToRecordList(blocks, (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      } else if (searchType === SEARCH_TYPE.SEMANTIC) {
        const canUseLocal = await modelRouter.isLocalAvailable();
        if (canUseLocal) {
          return this.searchByVector(keyword, limit);
        }
        const blocks = this.chunkDao.searchFts(keyword, limit);
        return this.blocksToRecordList(blocks, (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      }
      return [];
    } catch (error) {
      Logger.error("搜索语义块失败", {
        error: String(error),
        keyword,
        limit,
        searchType,
      });
      throw error;
    }
  }

  private async searchByVector(
    keyword: string,
    limit: number,
  ): Promise<ChunkItem[]> {
    try {
      const ANN_TOP_K = 50;
      const RERANK_TOP_K = 10;

      const { vector } = await embed(keyword, {
        modelName: "Xenova/jina-embeddings-v3",
      });

      const searchResults = await vectorService.searchBlockEmbeddings({
        vector,
        topK: ANN_TOP_K,
      });

      if (!searchResults || searchResults.length === 0) {
        return [];
      }

      const candidateBlockIds = searchResults.map((r) => r.item.block_id);
      const candidateBlocks = this.chunkDao.findByIds(candidateBlockIds);

      if (candidateBlocks.length === 0) {
        return [];
      }

      const blockMap = new Map(candidateBlocks.map((b) => [b.id, b]));
      const candidateContents: string[] = [];
      const orderedBlocks: Chunk[] = [];

      for (const blockId of candidateBlockIds) {
        const block = blockMap.get(blockId);
        if (block) {
          candidateContents.push(block.content);
          orderedBlocks.push(block);
        }
      }

      const rerankResults = await rerank(keyword, candidateContents, {
        modelName: "Xenova/bge-reranker-v2-m3",
      });

      const topKBlocks = rerankResults
        .slice(0, RERANK_TOP_K)
        .map((r) => orderedBlocks[r.index])
        .filter(Boolean);

      return this.blocksToRecordList(topKBlocks, (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    } catch (error) {
      Logger.error("向量语义搜索失败，回退到 SQL FTS", {
        error: String(error),
        keyword,
        limit,
      });
      const blocks = this.chunkDao.searchFts(keyword, limit);
      return this.blocksToRecordList(blocks, (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }
  }

  // ──────── 查询方法 ────────

  public getRecent(limit: number = 50): ChunkItem[] {
    try {
      const blocks = this.chunkDao.getRecentChunks(limit);
      return blocks.map((block) => this.blockToChunkItem(block));
    } catch (error) {
      Logger.error("获取最近语义块失败", { error: String(error), limit });
      throw error;
    }
  }

  public getWithTemporalScore(limit: number = 50): ChunkItem[] {
    try {
      const blocks = this.chunkDao.getChunksWithTemporalScore(limit);
      return this.blocksToRecordList(
        blocks,
        (a, b) => b.temporal_score - a.temporal_score,
      );
    } catch (error) {
      Logger.error("获取带时间衰减分数的语义块失败", {
        error: String(error),
        limit,
      });
      throw error;
    }
  }

  public getByProjectId(projectId: Id): ChunkItem[] {
    try {
      const projectChunks = this.projectChunkDao.findBy(
        "project_id",
        projectId,
      );
      const blockIds = projectChunks.map((pb) => pb.chunk_id);

      if (blockIds.length === 0) {
        return [];
      }

      const blocks = this.chunkDao.findByIds(blockIds);
      return this.blocksToRecordList(blocks, (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    } catch (error) {
      Logger.error("获取项目关联语义块失败", {
        error: String(error),
        projectId,
      });
      throw error;
    }
  }

  public getByDateRange(
    startDate?: string,
    endDate?: string,
  ): ChunkDateItem[] {
    try {
      let blocks: Chunk[];

      if (startDate && endDate) {
        const normalizeStart = (d: string) =>
          /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00.000Z` : d;
        const normalizeEnd = (d: string) =>
          /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T23:59:59.999Z` : d;
        const s = normalizeStart(startDate);
        const e = normalizeEnd(endDate);

        blocks = this.chunkDao.findByDateRange(s, e, "active");
      } else {
        const sql = `SELECT * FROM semantic_chunks WHERE status = 'active' ORDER BY created_at DESC LIMIT 20`;
        blocks = this.chunkDao.query(sql) as Chunk[];
      }

      const items = this.blocksToRecordList(blocks, (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );

      const dateMap = new Map<string, ChunkInfo[]>();
      for (const item of items) {
        const dateKey = item.created_at.slice(0, 10);
        const group = dateMap.get(dateKey);
        if (group) {
          group.push(item);
        } else {
          dateMap.set(dateKey, [item]);
        }
      }

      return Array.from(dateMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dateKey, journals]) => ({
          date: dateKey,
          chunks: journals,
        }));
    } catch (error) {
      Logger.error("根据日期范围查询语义块失败", {
        error: String(error),
        startDate,
        endDate,
      });
      throw error;
    }
  }

  // ──────── 项目关联操作 ────────

  public addToProject(
    recordId: Id,
    projectId: Id,
    relevanceScore?: number,
  ): void {
    try {
      this.projectChunkDao.addChunksToProject(
        projectId,
        [recordId],
        relevanceScore ? [relevanceScore] : undefined,
      );
    } catch (error) {
      Logger.error("添加语义块到项目失败", {
        error: String(error),
        recordId,
        projectId,
        relevanceScore,
      });
      throw error;
    }
  }

  public removeFromProject(recordId: Id, projectId: Id): void {
    try {
      this.projectChunkDao.deleteBy("project_id", projectId, recordId);
    } catch (error) {
      Logger.error("从项目移除语义块失败", {
        error: String(error),
        recordId,
        projectId,
      });
      throw error;
    }
  }
}

export default ChunkService;
export { ChunkService };

export const chunkService = ChunkService.getInstance();
