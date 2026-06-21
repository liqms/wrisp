import type { Connection, Table } from "@lancedb/lancedb";
import type {
  BlockEmbedding,
  BlockEmbeddingCreate,
  BlockEmbeddingUpdate,
  ConceptEmbedding,
  ConceptEmbeddingCreate,
  ConceptEmbeddingUpdate,
  PageEmbedding,
  PageEmbeddingCreate,
  PageEmbeddingUpdate,
  VectorSearchParams,
  VectorSearchResult,
  VectorStats,
  VectorTableName,
} from "@/main/types/db/vector.types";
import { Logger } from "@/main/utils/logger";
import {
  getBlockEmbeddingTable,
  getConceptEmbeddingTable,
  getPageEmbeddingTable,
} from "../vector/lancedb";

/**
 * 向量数据访问对象基类
 * 提供 LanceDB 向量数据库的通用操作方法
 */
export class BaseVectorDao {
  protected db: Connection;

  constructor(db: Connection) {
    this.db = db;
  }

  /**
   * 获取表实例
   */
  protected async getTable(tableName: VectorTableName): Promise<Table> {
    return await this.db.openTable(tableName);
  }
}

/**
 * Block 向量数据访问对象
 */
export class BlockVectorDao extends BaseVectorDao {
  /**
   * 创建 Block 向量记录
   */
  async create(data: BlockEmbeddingCreate): Promise<void> {
    try {
      const table = await this.getTable("block_embeddings");
      await table.add([data as BlockEmbedding]);
      Logger.debug("[BlockVectorDao] 创建向量记录", { block_id: data.block_id });
    } catch (error) {
      Logger.error("[BlockVectorDao] 创建 Block 向量失败", { error: String(error), data });
      throw error;
    }
  }

  /**
   * 批量创建 Block 向量记录
   */
  async createBatch(dataList: BlockEmbeddingCreate[]): Promise<void> {
    if (dataList.length === 0) {
      return;
    }
    try {
      const table = await this.getTable("block_embeddings");
      await table.add(dataList as BlockEmbedding[]);
      Logger.debug("[BlockVectorDao] 批量创建向量记录", { count: dataList.length });
    } catch (error) {
      Logger.error("[BlockVectorDao] 批量创建 Block 向量失败", {
        error: String(error),
        count: dataList.length,
      });
      throw error;
    }
  }

  /**
   * 根据 Block ID 更新向量
   */
  async update(blockId: string, data: BlockEmbeddingUpdate): Promise<void> {
    try {
      const table = await this.getTable("block_embeddings");
      await table.delete(`block_id = '${blockId}'`);
      await table.add([{ block_id: blockId, ...data } as BlockEmbedding]);
      Logger.debug("[BlockVectorDao] 更新向量记录", { block_id: blockId });
    } catch (error) {
      Logger.error("[BlockVectorDao] 更新 Block 向量失败", {
        error: String(error),
        blockId,
        data,
      });
      throw error;
    }
  }

  /**
   * 根据 Block ID 删除向量
   */
  async delete(blockId: string): Promise<void> {
    try {
      const table = await this.getTable("block_embeddings");
      await table.delete(`block_id = '${blockId}'`);
      Logger.debug("[BlockVectorDao] 删除向量记录", { block_id: blockId });
    } catch (error) {
      Logger.error("[BlockVectorDao] 删除 Block 向量失败", { error: String(error), blockId });
      throw error;
    }
  }

  /**
   * 根据 Block ID 批量删除向量
   */
  async deleteBatch(blockIds: string[]): Promise<void> {
    if (blockIds.length === 0) {
      return;
    }
    try {
      const table = await this.getTable("block_embeddings");
      for (const blockId of blockIds) {
        await table.delete(`block_id = '${blockId}'`);
      }
      Logger.debug("[BlockVectorDao] 批量删除向量记录", { count: blockIds.length });
    } catch (error) {
      Logger.error("[BlockVectorDao] 批量删除 Block 向量失败", {
        error: String(error),
        count: blockIds.length,
      });
      throw error;
    }
  }

  /**
   * 根据 Block ID 查询向量
   */
  async findByBlockId(blockId: string): Promise<BlockEmbedding | null> {
    try {
      const table = await this.getTable("block_embeddings");
      const results = await table
        .search([0])
        .where(`block_id = '${blockId}'`)
        .limit(1)
        .toArray();
      return (results[0] as BlockEmbedding) || null;
    } catch (error) {
      Logger.error("[BlockVectorDao] 查询 Block 向量失败", { error: String(error), blockId });
      throw error;
    }
  }

  /**
   * 语义搜索 Block 向量
   */
  async search(params: VectorSearchParams): Promise<VectorSearchResult<BlockEmbedding>[]> {
    try {
      const table = await this.getTable("block_embeddings");
      const results = await table.search(params.vector).limit(params.topK || 10).toArray();

      return results.map((item: unknown) => {
        const embedding = item as BlockEmbedding;
        return {
          item: embedding,
          score: 1 - (embedding._distance || 0),
          distance: embedding._distance,
        };
      });
    } catch (error) {
      Logger.error("[BlockVectorDao] 搜索 Block 向量失败", { error: String(error), params });
      throw error;
    }
  }

  /**
   * 检查 Block 向量是否存在
   */
  async exists(blockId: string): Promise<boolean> {
    try {
      const result = await this.findByBlockId(blockId);
      return result !== null;
    } catch (error) {
      Logger.error("[BlockVectorDao] 检查 Block 向量存在性失败", { error: String(error), blockId });
      return false;
    }
  }

  /**
   * 获取 Block 向量表统计信息
   */
  async getStats(): Promise<VectorStats> {
    try {
      const table = await this.getTable("block_embeddings");
      const count = await table.countRows();
      const indexes = await table.listIndices();

      return {
        tableName: "block_embeddings",
        rowCount: count,
        dimension: 1536,
        indexed: indexes.length > 0,
      };
    } catch (error) {
      Logger.error("[BlockVectorDao] 获取统计信息失败", { error: String(error) });
      throw error;
    }
  }
}

/**
 * 概念向量数据访问对象
 */
export class ConceptVectorDao extends BaseVectorDao {
  /**
   * 创建概念向量记录
   */
  async create(data: ConceptEmbeddingCreate): Promise<void> {
    try {
      const table = await this.getTable("concept_embeddings");
      await table.add([data as ConceptEmbedding]);
      Logger.debug("[ConceptVectorDao] 创建向量记录", { concept_id: data.concept_id });
    } catch (error) {
      Logger.error("[ConceptVectorDao] 创建概念向量失败", { error: String(error), data });
      throw error;
    }
  }

  /**
   * 批量创建概念向量记录
   */
  async createBatch(dataList: ConceptEmbeddingCreate[]): Promise<void> {
    if (dataList.length === 0) {
      return;
    }
    try {
      const table = await this.getTable("concept_embeddings");
      await table.add(dataList as ConceptEmbedding[]);
      Logger.debug("[ConceptVectorDao] 批量创建向量记录", { count: dataList.length });
    } catch (error) {
      Logger.error("[ConceptVectorDao] 批量创建概念向量失败", {
        error: String(error),
        count: dataList.length,
      });
      throw error;
    }
  }

  /**
   * 根据概念 ID 更新向量
   */
  async update(conceptId: string, data: ConceptEmbeddingUpdate): Promise<void> {
    try {
      const table = await this.getTable("concept_embeddings");
      await table.delete(`concept_id = '${conceptId}'`);
      await table.add([{ concept_id: conceptId, ...data } as ConceptEmbedding]);
      Logger.debug("[ConceptVectorDao] 更新向量记录", { concept_id: conceptId });
    } catch (error) {
      Logger.error("[ConceptVectorDao] 更新概念向量失败", {
        error: String(error),
        conceptId,
        data,
      });
      throw error;
    }
  }

  /**
   * 根据概念 ID 删除向量
   */
  async delete(conceptId: string): Promise<void> {
    try {
      const table = await this.getTable("concept_embeddings");
      await table.delete(`concept_id = '${conceptId}'`);
      Logger.debug("[ConceptVectorDao] 删除向量记录", { concept_id: conceptId });
    } catch (error) {
      Logger.error("[ConceptVectorDao] 删除概念向量失败", { error: String(error), conceptId });
      throw error;
    }
  }

  /**
   * 根据概念 ID 批量删除向量
   */
  async deleteBatch(conceptIds: string[]): Promise<void> {
    if (conceptIds.length === 0) {
      return;
    }
    try {
      const table = await this.getTable("concept_embeddings");
      for (const conceptId of conceptIds) {
        await table.delete(`concept_id = '${conceptId}'`);
      }
      Logger.debug("[ConceptVectorDao] 批量删除向量记录", { count: conceptIds.length });
    } catch (error) {
      Logger.error("[ConceptVectorDao] 批量删除概念向量失败", {
        error: String(error),
        count: conceptIds.length,
      });
      throw error;
    }
  }

  /**
   * 根据概念 ID 查询向量
   */
  async findByConceptId(conceptId: string): Promise<ConceptEmbedding | null> {
    try {
      const table = await this.getTable("concept_embeddings");
      const results = await table
        .search([0])
        .where(`concept_id = '${conceptId}'`)
        .limit(1)
        .toArray();
      return (results[0] as ConceptEmbedding) || null;
    } catch (error) {
      Logger.error("[ConceptVectorDao] 查询概念向量失败", { error: String(error), conceptId });
      throw error;
    }
  }

  /**
   * 语义搜索概念向量
   */
  async search(params: VectorSearchParams): Promise<VectorSearchResult<ConceptEmbedding>[]> {
    try {
      const table = await this.getTable("concept_embeddings");
      const results = await table.search(params.vector).limit(params.topK || 10).toArray();

      return results.map((item: unknown) => {
        const embedding = item as ConceptEmbedding;
        return {
          item: embedding,
          score: 1 - (embedding._distance || 0),
          distance: embedding._distance,
        };
      });
    } catch (error) {
      Logger.error("[ConceptVectorDao] 搜索概念向量失败", { error: String(error), params });
      throw error;
    }
  }

  /**
   * 检查概念向量是否存在
   */
  async exists(conceptId: string): Promise<boolean> {
    try {
      const result = await this.findByConceptId(conceptId);
      return result !== null;
    } catch (error) {
      Logger.error("[ConceptVectorDao] 检查概念向量存在性失败", { error: String(error), conceptId });
      return false;
    }
  }

  /**
   * 获取概念向量表统计信息
   */
  async getStats(): Promise<VectorStats> {
    try {
      const table = await this.getTable("concept_embeddings");
      const count = await table.countRows();
      const indexes = await table.listIndices();

      return {
        tableName: "concept_embeddings",
        rowCount: count,
        dimension: 1536,
        indexed: indexes.length > 0,
      };
    } catch (error) {
      Logger.error("[ConceptVectorDao] 获取统计信息失败", { error: String(error) });
      throw error;
    }
  }
}

/**
 * 页面向量数据访问对象
 */
export class PageVectorDao extends BaseVectorDao {
  /**
   * 创建页面向量记录
   */
  async create(data: PageEmbeddingCreate): Promise<void> {
    try {
      const table = await this.getTable("pages_embeddings");
      await table.add([data as PageEmbedding]);
      Logger.debug("[PageVectorDao] 创建向量记录", { page_id: data.page_id });
    } catch (error) {
      Logger.error("[PageVectorDao] 创建页面向量失败", { error: String(error), data });
      throw error;
    }
  }

  /**
   * 批量创建页面向量记录
   */
  async createBatch(dataList: PageEmbeddingCreate[]): Promise<void> {
    if (dataList.length === 0) {
      return;
    }
    try {
      const table = await this.getTable("pages_embeddings");
      await table.add(dataList as PageEmbedding[]);
      Logger.debug("[PageVectorDao] 批量创建向量记录", { count: dataList.length });
    } catch (error) {
      Logger.error("[PageVectorDao] 批量创建页面向量失败", {
        error: String(error),
        count: dataList.length,
      });
      throw error;
    }
  }

  /**
   * 根据页面 ID 更新向量
   */
  async update(pageId: string, data: PageEmbeddingUpdate): Promise<void> {
    try {
      const table = await this.getTable("pages_embeddings");
      await table.delete(`page_id = '${pageId}'`);
      await table.add([{ page_id: pageId, ...data } as PageEmbedding]);
      Logger.debug("[PageVectorDao] 更新向量记录", { page_id: pageId });
    } catch (error) {
      Logger.error("[PageVectorDao] 更新页面向量失败", {
        error: String(error),
        pageId,
        data,
      });
      throw error;
    }
  }

  /**
   * 根据页面 ID 删除向量
   */
  async delete(pageId: string): Promise<void> {
    try {
      const table = await this.getTable("pages_embeddings");
      await table.delete(`page_id = '${pageId}'`);
      Logger.debug("[PageVectorDao] 删除向量记录", { page_id: pageId });
    } catch (error) {
      Logger.error("[PageVectorDao] 删除页面向量失败", { error: String(error), pageId });
      throw error;
    }
  }

  /**
   * 根据页面 ID 批量删除向量
   */
  async deleteBatch(pageIds: string[]): Promise<void> {
    if (pageIds.length === 0) {
      return;
    }
    try {
      const table = await this.getTable("pages_embeddings");
      for (const pageId of pageIds) {
        await table.delete(`page_id = '${pageId}'`);
      }
      Logger.debug("[PageVectorDao] 批量删除向量记录", { count: pageIds.length });
    } catch (error) {
      Logger.error("[PageVectorDao] 批量删除页面向量失败", {
        error: String(error),
        count: pageIds.length,
      });
      throw error;
    }
  }

  /**
   * 根据页面 ID 查询向量
   */
  async findByPageId(pageId: string): Promise<PageEmbedding | null> {
    try {
      const table = await this.getTable("pages_embeddings");
      const results = await table
        .search([0])
        .where(`page_id = '${pageId}'`)
        .limit(1)
        .toArray();
      return (results[0] as PageEmbedding) || null;
    } catch (error) {
      Logger.error("[PageVectorDao] 查询页面向量失败", { error: String(error), pageId });
      throw error;
    }
  }

  /**
   * 根据项目 ID 查询所有页面向量
   */
  async findByProjectId(projectId: string): Promise<PageEmbedding[]> {
    try {
      const table = await this.getTable("pages_embeddings");
      const results = await table
        .search([0])
        .where(`project_id = '${projectId}'`)
        .limit(1000)
        .toArray();
      return results as PageEmbedding[];
    } catch (error) {
      Logger.error("[PageVectorDao] 查询项目页面向量失败", { error: String(error), projectId });
      throw error;
    }
  }

  /**
   * 语义搜索页面向量
   */
  async search(params: VectorSearchParams): Promise<VectorSearchResult<PageEmbedding>[]> {
    try {
      const table = await this.getTable("pages_embeddings");
      let query = table.search(params.vector).limit(params.topK || 10);

      if (params.projectId) {
        query = query.where(`project_id = '${params.projectId}'`);
      }

      const results = await query.toArray();

      return results.map((item: unknown) => {
        const embedding = item as PageEmbedding;
        return {
          item: embedding,
          score: 1 - (embedding._distance || 0),
          distance: embedding._distance,
        };
      });
    } catch (error) {
      Logger.error("[PageVectorDao] 搜索页面向量失败", { error: String(error), params });
      throw error;
    }
  }

  /**
   * 检查页面向量是否存在
   */
  async exists(pageId: string): Promise<boolean> {
    try {
      const result = await this.findByPageId(pageId);
      return result !== null;
    } catch (error) {
      Logger.error("[PageVectorDao] 检查页面向量存在性失败", { error: String(error), pageId });
      return false;
    }
  }

  /**
   * 获取页面向量表统计信息
   */
  async getStats(): Promise<VectorStats> {
    try {
      const table = await this.getTable("pages_embeddings");
      const count = await table.countRows();
      const indexes = await table.listIndices();

      return {
        tableName: "pages_embeddings",
        rowCount: count,
        dimension: 1536,
        indexed: indexes.length > 0,
      };
    } catch (error) {
      Logger.error("[PageVectorDao] 获取统计信息失败", { error: String(error) });
      throw error;
    }
  }
}
