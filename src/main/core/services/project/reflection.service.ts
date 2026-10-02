import { ReflectionDao, ReflectionChunkDao, ChunkDao } from "@/main/core/db";
import type {
  Reflection,
  ReflectionWithBlocks,
} from "@/main/types/db";
import { PaginationResult } from "@/shared/utils/pagination";
import { Logger } from "@/main/utils/logger";

class ReflectionService {
  private static instance: ReflectionService | null = null;
  private reflectionDao: ReflectionDao;
  private reflectionChunkDao: ReflectionChunkDao;
  private chunkDao: ChunkDao;

  private constructor() {
    this.reflectionDao = new ReflectionDao();
    this.reflectionChunkDao = new ReflectionChunkDao();
    this.chunkDao = new ChunkDao();
  }

  public static getInstance(): ReflectionService {
    if (!ReflectionService.instance) {
      ReflectionService.instance = new ReflectionService();
    }
    return ReflectionService.instance;
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

      const reflectionChunks = this.reflectionChunkDao.findBy("reflection_id", id);
      const blockIds = reflectionChunks.map((rb) => rb.chunk_id);
      const blocks = blockIds.length > 0 ? this.chunkDao.findByIds(blockIds) : [];

      return {
        ...reflection,
        blocks: blocks.map((b) => ({
          id: b.id,
          content: b.content,
          relevance_score: reflectionChunks.find((rb) => rb.chunk_id === b.id)?.relevance_score || 0,
        })),
      } as ReflectionWithBlocks;
    } catch (error) {
      Logger.error("获取反思详情失败", { error: String(error), id });
      throw error;
    }
  }
}

export default ReflectionService;
export const reflectionService = ReflectionService.getInstance();