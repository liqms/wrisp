import { BaseDao } from './base.dao'
import {
  SemanticLink,
  SemanticLinkCreate,
  SemanticLinkUpdate,
  SemanticLinkQuery,
  SemanticLinkWithBlocks,
  LinkType,
} from '@/main/types/db'

type FindByField = 'source_chunk_id' | 'target_chunk_id' | 'link_type'
type CountByField = 'source_chunk_id' | 'link_type'

export class SemanticLinkDao extends BaseDao<SemanticLink, SemanticLinkCreate, SemanticLinkUpdate> {
  constructor() {
    super('semantic_links')
  }

  /**
   * 根据指定字段查询语义链接列表
   * @param field 查询字段 (source_chunk_id | target_chunk_id | link_type)
   * @param value 字段值
   */
  findBy(field: FindByField, value: string | LinkType): SemanticLink[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${field} = ? ORDER BY similarity DESC`
    return this.query(sql, [value])
  }

  /**
   * 根据 chunk ID 查询其作为源的语义链接
   * @param chunkId chunk ID
   */
  findByChunkId(chunkId: string): SemanticLink[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE source_chunk_id = ? ORDER BY similarity DESC`
    return this.query(sql, [chunkId])
  }

  /**
   * 获取语义链接及其关联的 chunk 内容
   * @param sourceChunkId 源 chunk ID
   */
  findWithChunks(sourceChunkId: string): SemanticLinkWithBlocks[] {
    const sql = `
      SELECT sl.*, source.content AS source_content, target.content AS target_content
      FROM ${this.tableName} sl
      JOIN semantic_chunks source ON sl.source_chunk_id = source.id
      JOIN semantic_chunks target ON sl.target_chunk_id = target.id
      WHERE sl.source_chunk_id = ?
      ORDER BY sl.similarity DESC
    `
    return this.query(sql, [sourceChunkId]) as SemanticLinkWithBlocks[]
  }

  /**
   * 根据相似度范围查询语义链接列表
   * @param minSimilarity 最低相似度
   * @param maxSimilarity 最高相似度
   */
  findBySimilarityRange(minSimilarity: number, maxSimilarity: number): SemanticLink[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE similarity >= ? AND similarity <= ? ORDER BY similarity DESC`
    return this.query(sql, [minSimilarity, maxSimilarity])
  }

  /**
   * 检查链接是否存在
   * @param sourceChunkId 源 chunk ID
   * @param targetChunkId 目标 chunk ID
   */
  checkLinkExists(sourceChunkId: string, targetChunkId: string): boolean {
    const sql = `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE source_chunk_id = ? AND target_chunk_id = ?) as exists`
    const stmt = this.db.prepare(sql)
    const result = stmt.get([sourceChunkId, targetChunkId]) as { exists: number }
    return result?.exists === 1
  }

  /**
   * 根据 chunk ID 删除所有关联的语义链接
   * @param chunkId chunk ID
   */
  deleteByChunkId(chunkId: string): number {
    const sql = `DELETE FROM ${this.tableName} WHERE source_chunk_id = ? OR target_chunk_id = ?`
    const stmt = this.db.prepare(sql)
    const result = stmt.run([chunkId, chunkId])
    return result.changes
  }

  /**
   * 更新链接的相似度
   * @param id 语义链接 ID
   * @param similarity 相似度
   */
  updateSimilarity(id: string, similarity: number): number {
    const sql = `UPDATE ${this.tableName} SET similarity = ?, updated_at = ? WHERE id = ?`
    const stmt = this.db.prepare(sql)
    const result = stmt.run([similarity, this.getCurrentTimestamp(), id])
    return result.changes
  }

  /**
   * 根据指定字段统计语义链接数量
   * @param field 统计字段 (source_chunk_id | link_type)
   * @param value 字段值
   */
  countBy(field: CountByField, value: string | LinkType): number {
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${field} = ?`
    const result = this.queryOne(sql, [value]) as unknown as { count: number }
    return result?.count || 0
  }

  /**
   * 构建 WHERE 子句
   * @param conditions 查询条件
   */
  protected buildWhereClause(conditions: SemanticLinkQuery): { sql: string; values: unknown[] } {
    const conditionsArray: string[] = []
    const values: unknown[] = []

    if (conditions.source_chunk_id !== undefined) {
      conditionsArray.push('source_chunk_id = ?')
      values.push(conditions.source_chunk_id)
    }
    if (conditions.target_chunk_id !== undefined) {
      conditionsArray.push('target_chunk_id = ?')
      values.push(conditions.target_chunk_id)
    }
    if (conditions.link_type !== undefined) {
      conditionsArray.push('link_type = ?')
      values.push(conditions.link_type)
    }
    if (conditions.similarity_min !== undefined) {
      conditionsArray.push('similarity >= ?')
      values.push(conditions.similarity_min)
    }
    if (conditions.similarity_max !== undefined) {
      conditionsArray.push('similarity <= ?')
      values.push(conditions.similarity_max)
    }

    const sql = conditionsArray.length > 0 ? conditionsArray.join(' AND ') : '1=1'
    return { sql, values }
  }
}

export const semanticLinkDao = new SemanticLinkDao()