import type { Connection } from "@lancedb/lancedb";
import type {
  BlockEmbedding,
  BlockEmbeddingCreate,
  BlockEmbeddingUpdate,
  PageEmbeddingCreate,
  PageEmbeddingUpdate,
  VectorSearchParams,
  VectorSearchResult,
  VectorStats,
} from "@/main/types/db/vector.types";
import {
  BlockVectorDao,
  PageVectorDao,
} from "@/main/core/db/vector.dao";
import { Logger } from "@/main/utils/logger";
import { initializeLanceDB } from "@/main/core/vector/lancedb";

/**
 * 向量数据库服务
 * 提供向量数据的 CRUD 操作及业务逻辑封装
 */
class VectorService {
  private static instance: VectorService | null = null;
  private db: Connection | null = null;
  private blockVectorDao: BlockVectorDao | null = null;
  private pageVectorDao: PageVectorDao | null = null;
  private initialized: boolean = false;

  private constructor() { }

  /**
   * 获取 VectorService 单例实例
   */
  public static getInstance(): VectorService {
    if (!VectorService.instance) {
      VectorService.instance = new VectorService();
    }
    return VectorService.instance;
  }

  /**
   * 初始化向量数据库连接
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.db = await initializeLanceDB();
      this.blockVectorDao = new BlockVectorDao(this.db);
      this.pageVectorDao = new PageVectorDao(this.db);
      this.initialized = true;
      Logger.info("[VectorService] 向量数据库服务初始化成功");
    } catch (error) {
      Logger.error("[VectorService] 向量数据库服务初始化失败", {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * 确保服务已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.db || !this.blockVectorDao || !this.pageVectorDao) {
      throw new Error("[VectorService] 服务未初始化，请先调用 initialize()");
    }
  }

  // ==================== Block 向量操作 ====================

  /**
   * 创建 Block 向量
   */
  public async createBlockEmbedding(data: BlockEmbeddingCreate): Promise<void> {
    this.ensureInitialized();
    try {
      await this.blockVectorDao!.create(data);
      Logger.info("[VectorService] 创建 Block 向量成功", { block_id: data.block_id });
    } catch (error) {
      Logger.error("[VectorService] 创建 Block 向量失败", { error: String(error), data });
      throw error;
    }
  }

  /**
   * 批量创建 Block 向量
   */
  public async createBlockEmbeddings(dataList: BlockEmbeddingCreate[]): Promise<void> {
    this.ensureInitialized();
    try {
      await this.blockVectorDao!.createBatch(dataList);
      Logger.info("[VectorService] 批量创建 Block 向量成功", { count: dataList.length });
    } catch (error) {
      Logger.error("[VectorService] 批量创建 Block 向量失败", {
        error: String(error),
        count: dataList.length,
      });
      throw error;
    }
  }

  /**
   * 更新 Block 向量
   */
  public async updateBlockEmbedding(blockId: string, data: BlockEmbeddingUpdate): Promise<void> {
    this.ensureInitialized();
    try {
      await this.blockVectorDao!.update(blockId, data);
      Logger.info("[VectorService] 更新 Block 向量成功", { block_id: blockId });
    } catch (error) {
      Logger.error("[VectorService] 更新 Block 向量失败", { error: String(error), blockId, data });
      throw error;
    }
  }

  /**
   * 删除 Block 向量
   */
  public async deleteBlockEmbedding(blockId: string): Promise<void> {
    this.ensureInitialized();
    try {
      await this.blockVectorDao!.delete(blockId);
      Logger.info("[VectorService] 删除 Block 向量成功", { block_id: blockId });
    } catch (error) {
      Logger.error("[VectorService] 删除 Block 向量失败", { error: String(error), blockId });
      throw error;
    }
  }

  /**
   * 批量删除 Block 向量
   */
  public async deleteBlockEmbeddings(blockIds: string[]): Promise<void> {
    this.ensureInitialized();
    try {
      await this.blockVectorDao!.deleteBatch(blockIds);
      Logger.info("[VectorService] 批量删除 Block 向量成功", { count: blockIds.length });
    } catch (error) {
      Logger.error("[VectorService] 批量删除 Block 向量失败", {
        error: String(error),
        count: blockIds.length,
      });
      throw error;
    }
  }

  /**
   * 根据 Block ID 查询向量（返回数组，便于统一处理）
   */
  public async findBlockEmbeddingByBlockId(blockId: string): Promise<BlockEmbedding[]> {
    this.ensureInitialized();
    try {
      const result = await this.blockVectorDao!.findByBlockId(blockId);
      return result ? [result] : [];
    } catch (error) {
      Logger.error("[VectorService] 查询 Block 向量失败", { error: String(error), blockId });
      return [];
    }
  }

  /**
   * 搜索相似 Block 向量
   */
  public async searchBlockEmbeddings(
    params: VectorSearchParams,
  ): Promise<VectorSearchResult<import("@/main/types/db/vector.types").BlockEmbedding>[]> {
    this.ensureInitialized();
    try {
      const results = await this.blockVectorDao!.search(params);
      Logger.debug("[VectorService] 搜索 Block 向量成功", { topK: params.topK, count: results.length });
      return results;
    } catch (error) {
      Logger.error("[VectorService] 搜索 Block 向量失败", { error: String(error), params });
      throw error;
    }
  }

  // ==================== 页面向量操作 ====================

  /**
   * 创建页面向量
   */
  public async createPageEmbedding(data: PageEmbeddingCreate): Promise<void> {
    this.ensureInitialized();
    try {
      await this.pageVectorDao!.create(data);
      Logger.info("[VectorService] 创建页面向量成功", { page_id: data.page_id });
    } catch (error) {
      Logger.error("[VectorService] 创建页面向量失败", { error: String(error), data });
      throw error;
    }
  }

  /**
   * 批量创建页面向量
   */
  public async createPageEmbeddings(dataList: PageEmbeddingCreate[]): Promise<void> {
    this.ensureInitialized();
    try {
      await this.pageVectorDao!.createBatch(dataList);
      Logger.info("[VectorService] 批量创建页面向量成功", { count: dataList.length });
    } catch (error) {
      Logger.error("[VectorService] 批量创建页面向量失败", {
        error: String(error),
        count: dataList.length,
      });
      throw error;
    }
  }

  /**
   * 更新页面向量
   */
  public async updatePageEmbedding(pageId: string, data: PageEmbeddingUpdate): Promise<void> {
    this.ensureInitialized();
    try {
      await this.pageVectorDao!.update(pageId, data);
      Logger.info("[VectorService] 更新页面向量成功", { page_id: pageId });
    } catch (error) {
      Logger.error("[VectorService] 更新页面向量失败", { error: String(error), pageId, data });
      throw error;
    }
  }

  /**
   * 删除页面向量
   */
  public async deletePageEmbedding(pageId: string): Promise<void> {
    this.ensureInitialized();
    try {
      await this.pageVectorDao!.delete(pageId);
      Logger.info("[VectorService] 删除页面向量成功", { page_id: pageId });
    } catch (error) {
      Logger.error("[VectorService] 删除页面向量失败", { error: String(error), pageId });
      throw error;
    }
  }

  /**
   * 批量删除页面向量
   */
  public async deletePageEmbeddings(pageIds: string[]): Promise<void> {
    this.ensureInitialized();
    try {
      await this.pageVectorDao!.deleteBatch(pageIds);
      Logger.info("[VectorService] 批量删除页面向量成功", { count: pageIds.length });
    } catch (error) {
      Logger.error("[VectorService] 批量删除页面向量失败", {
        error: String(error),
        count: pageIds.length,
      });
      throw error;
    }
  }

  /**
   * 搜索相似页面向量
   */
  public async searchPageEmbeddings(
    params: VectorSearchParams,
  ): Promise<VectorSearchResult<import("@/main/types/db/vector.types").PageEmbedding>[]> {
    this.ensureInitialized();
    try {
      const results = await this.pageVectorDao!.search(params);
      Logger.debug("[VectorService] 搜索页面向量成功", { topK: params.topK, count: results.length });
      return results;
    } catch (error) {
      Logger.error("[VectorService] 搜索页面向量失败", { error: String(error), params });
      throw error;
    }
  }

  // ==================== 统计信息 ====================

  /**
   * 获取所有向量表统计信息
   */
  public async getAllStats(): Promise<VectorStats[]> {
    this.ensureInitialized();
    try {
      const [blockStats, pageStats] = await Promise.all([
        this.blockVectorDao!.getStats(),
        this.pageVectorDao!.getStats(),
      ]);
      return [blockStats, pageStats];
    } catch (error) {
      Logger.error("[VectorService] 获取统计信息失败", { error: String(error) });
      throw error;
    }
  }
}

export default VectorService;

export const vectorService = VectorService.getInstance();
