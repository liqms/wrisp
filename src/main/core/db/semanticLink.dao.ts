import { BaseDao } from './base.dao'
import {
  SemanticLink,
  SemanticLinkCreate,
  SemanticLinkUpdate,
  SemanticLinkQuery,
  SemanticLinkWithBlocks,
  LinkType,
} from '@/main/types/db'

type FindByField = 'source_block_id' | 'target_block_id' | 'link_type'
type CountByField = 'source_block_id' | 'link_type'

export class SemanticLinkDao extends BaseDao<SemanticLink, SemanticLinkCreate, SemanticLinkUpdate> {
  constructor() {
    super('semantic_links')
  }

  /**
   * 根据指定字段查询语义链接列表
   * @param field 查询字段 (source_block_id | target_block_id | link_type)
   * @param value 字段值
   */
  findBy(field: FindByField, value: string | LinkType): SemanticLink[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${field} = ? ORDER BY similarity DESC`
    return this.query(sql, [value])
  }

  /**
   * 获取语义链接及其关联的 Block 内容
   * @param sourceBlockId 源 Block ID
   */
  findWithBlocks(sourceBlockId: string): SemanticLinkWithBlocks[] {
    const sql = `
      SELECT sl.*, source.content AS source_content, target.content AS target_content
      FROM ${this.tableName} sl
      JOIN blocks source ON sl.source_block_id = source.id
      JOIN blocks target ON sl.target_block_id = target.id
      WHERE sl.source_block_id = ?
      ORDER BY sl.similarity DESC
    `
    return this.query(sql, [sourceBlockId]) as SemanticLinkWithBlocks[]
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
   * @param sourceBlockId 源 Block ID
   * @param targetBlockId 目标 Block ID
   */
  checkLinkExists(sourceBlockId: string, targetBlockId: string): boolean {
    const sql = `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE source_block_id = ? AND target_block_id = ?) as exists`
    const stmt = this.db.prepare(sql)
    const result = stmt.get([sourceBlockId, targetBlockId]) as { exists: number }
    return result?.exists === 1
  }

  /**
   * 根据 Block ID 删除所有关联的语义链接
   * @param blockId Block ID
   */
  deleteByBlockId(blockId: string): number {
    const sql = `DELETE FROM ${this.tableName} WHERE source_block_id = ? OR target_block_id = ?`
    const stmt = this.db.prepare(sql)
    const result = stmt.run([blockId, blockId])
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
   * @param field 统计字段 (source_block_id | link_type)
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

    if (conditions.source_block_id !== undefined) {
      conditionsArray.push('source_block_id = ?')
      values.push(conditions.source_block_id)
    }
    if (conditions.target_block_id !== undefined) {
      conditionsArray.push('target_block_id = ?')
      values.push(conditions.target_block_id)
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