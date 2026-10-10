import type { Connection, Table } from "@lancedb/lancedb";
import type {
  ChunkEmbedding,
  ChunkEmbeddingCreate,
  ChunkEmbeddingUpdate,
  PageEmbedding,
  PageEmbeddingCreate,
  PageEmbeddingUpdate,
  VectorSearchParams,
  VectorSearchResult,
  VectorStats,
  VectorTableName,
} from "@/main/types/db/vector.types";
import { Logger } from "@/main/utils/logger";
import { buildProjectFilter } from "@/main/core/vector/project-filter";
import { EMBEDDING_DIMENSION } from "@/main/core/model-gateway/local-gateway/model-registry";

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
 * Chunk 向量数据访问对象
 */
export class ChunkVectorDao extends BaseVectorDao {
  /**
   * 创建 Chunk 向量记录
   */
  async create(data: ChunkEmbeddingCreate): Promise<void> {
    try {
      const table = await this.getTable("chunk_embeddings");
      await table.add([data as ChunkEmbedding]);
      Logger.debug("[ChunkVectorDao] 创建向量记录", { chunk_id: data.chunk_id });
    } catch (error) {
      Logger.error("[ChunkVectorDao] 创建 Chunk 向量失败", { error: String(error), data });
      throw error;
    }
  }

  /**
   * 批量创建 Chunk 向量记录
   *
   * 一律**先删后加**：LanceDB 的 `add` 是纯追加，同一 chunk_id 重跑会留下多行向量，
   * 每行各占一个 topK 名额，把召回结果压死（迭代 6 后向量化会因内容变更重跑，
   * 这条路径不再是「每个块只写一次」）。
   */
  async createBatch(dataList: ChunkEmbeddingCreate[]): Promise<void> {
    if (dataList.length === 0) {
      return;
    }
    try {
      const table = await this.getTable("chunk_embeddings");
      await table.delete(
        `chunk_id IN (${dataList.map((d) => `'${d.chunk_id}'`).join(", ")})`,
      );
      await table.add(dataList as ChunkEmbedding[]);
      Logger.debug("[ChunkVectorDao] 批量创建向量记录", { count: dataList.length });
    } catch (error) {
      Logger.error("[ChunkVectorDao] 批量创建 Chunk 向量失败", {
        error: String(error),
        count: dataList.length,
      });
      throw error;
    }
  }

  /**
   * 根据 Chunk ID 更新向量
   */
  async update(chunkId: string, data: ChunkEmbeddingUpdate): Promise<void> {
    try {
      const table = await this.getTable("chunk_embeddings");
      const existing = (await table
        .query()
        .where(`chunk_id = '${chunkId}'`)
        .limit(1)
        .toArray()) as ChunkEmbedding[];
      const projectId = data.project_id ?? existing[0]?.project_id ?? null;
      await table.delete(`chunk_id = '${chunkId}'`);
      await table.add([
        { chunk_id: chunkId, project_id: projectId, ...data } as ChunkEmbedding,
      ]);
      Logger.debug("[ChunkVectorDao] 更新向量记录", { chunk_id: chunkId });
    } catch (error) {
      Logger.error("[ChunkVectorDao] 更新 Chunk 向量失败", {
        error: String(error),
        chunkId,
        data,
      });
      throw error;
    }
  }

  /**
   * 根据 Chunk ID 删除向量
   */
  async delete(chunkId: string): Promise<void> {
    try {
      const table = await this.getTable("chunk_embeddings");
      await table.delete(`chunk_id = '${chunkId}'`);
      Logger.debug("[ChunkVectorDao] 删除向量记录", { chunk_id: chunkId });
    } catch (error) {
      Logger.error("[ChunkVectorDao] 删除 Chunk 向量失败", { error: String(error), chunkId });
      throw error;
    }
  }

  /**
   * 根据 Chunk ID 批量删除向量
   */
  async deleteBatch(chunkIds: string[]): Promise<void> {
    if (chunkIds.length === 0) {
      return;
    }
    try {
      const table = await this.getTable("chunk_embeddings");
      for (const chunkId of chunkIds) {
        await table.delete(`chunk_id = '${chunkId}'`);
      }
      Logger.debug("[ChunkVectorDao] 批量删除向量记录", { count: chunkIds.length });
    } catch (error) {
      Logger.error("[ChunkVectorDao] 批量删除 Chunk 向量失败", {
        error: String(error),
        count: chunkIds.length,
      });
      throw error;
    }
  }

  /**
   * 根据 Chunk ID 查询向量
   */
  async findByChunkId(chunkId: string): Promise<ChunkEmbedding | null> {
    try {
      const table = await this.getTable("chunk_embeddings");
      const results = await table
        .query()
        .where(`chunk_id = '${chunkId}'`)
        .limit(1)
        .toArray();
      return (results[0] as ChunkEmbedding) || null;
    } catch (error) {
      Logger.error("[ChunkVectorDao] 查询 Chunk 向量失败", { error: String(error), chunkId });
      throw error;
    }
  }

  /**
   * 语义搜索 Chunk 向量
   */
  async search(params: VectorSearchParams): Promise<VectorSearchResult<ChunkEmbedding>[]> {
    try {
      const table = await this.getTable("chunk_embeddings");
      let query = table.search(params.vector).limit(params.topK || 10);

      if (params.projectId) {
        query = query.where(buildProjectFilter(params.projectId));
      }

      const results = await query.toArray();

      return results.map((item: unknown) => {
        const embedding = item as ChunkEmbedding;
        return {
          item: embedding,
          score: 1 - (embedding._distance || 0),
          distance: embedding._distance,
        };
      });
    } catch (error) {
      Logger.error("[ChunkVectorDao] 搜索 Chunk 向量失败", { error: String(error), params });
      throw error;
    }
  }

  /**
   * 检查 Chunk 向量是否存在
   */
  async exists(chunkId: string): Promise<boolean> {
    try {
      const result = await this.findByChunkId(chunkId);
      return result !== null;
    } catch (error) {
      Logger.error("[ChunkVectorDao] 检查 Chunk 向量存在性失败", { error: String(error), chunkId });
      return false;
    }
  }

  /**
   * 获取 Chunk 向量表统计信息
   */
  async getStats(): Promise<VectorStats> {
    try {
      const table = await this.getTable("chunk_embeddings");
      const count = await table.countRows();
      const indexes = await table.listIndices();

      return {
        tableName: "chunk_embeddings",
        rowCount: count,
        dimension: EMBEDDING_DIMENSION,
        indexed: indexes.length > 0,
      };
    } catch (error) {
      Logger.error("[ChunkVectorDao] 获取统计信息失败", { error: String(error) });
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
   *
   * 与 ChunkVectorDao.createBatch 同形，一律**先删后加**：
   * LanceDB 的 `add` 是纯追加，同一 page_id 重跑会留下多行向量，
   * 每行各占一个 topK 名额，把召回结果压死（页面内容变更后重跑会走到这条路径）。
   */
  async createBatch(dataList: PageEmbeddingCreate[]): Promise<void> {
    if (dataList.length === 0) {
      return;
    }
    try {
      const table = await this.getTable("pages_embeddings");
      await table.delete(
        `page_id IN (${dataList.map((d) => `'${d.page_id}'`).join(", ")})`,
      );
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
        .query()
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
        .query()
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
        query = query.where(buildProjectFilter(params.projectId));
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
        dimension: EMBEDDING_DIMENSION,
        indexed: indexes.length > 0,
      };
    } catch (error) {
      Logger.error("[PageVectorDao] 获取统计信息失败", { error: String(error) });
      throw error;
    }
  }
}
