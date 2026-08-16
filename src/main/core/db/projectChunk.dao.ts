import { BaseDao } from './base.dao'
import {
  ProjectChunk,
  ProjectChunkCreate,
  ProjectChunkUpdate,
  ProjectChunkQuery,
  ProjectChunkWithDetails,
  Id
} from '@/main/types/db'

type FindByField = 'project_id' | 'chunk_id'
type DeleteByField = 'project_id' | 'chunk_id'
type CountByField = 'project_id' | 'chunk_id'

export class ProjectChunkDao extends BaseDao<ProjectChunk, ProjectChunkCreate, ProjectChunkUpdate> {
  constructor() {
    super('project_chunks')
  }

  /**
   * 根据指定字段查询项目块关联列表
   * @param field 查询字段 (project_id | chunk_id)
   * @param value 字段值
   */
  findBy(field: FindByField, value: Id): ProjectChunk[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE ${field} = ? ORDER BY relevance_score DESC`
    return this.query(sql, [value])
  }

  /**
   * 获取项目块关联及其详细信息
   * @param projectId 项目 ID
   */
  findByProjectIdWithDetails(projectId: Id): ProjectChunkWithDetails[] {
    const sql = `
      SELECT pb.*, b.content AS chunk_content, b.created_at AS chunk_created_at
      FROM ${this.tableName} pb
      JOIN semantic_chunks b ON pb.chunk_id = b.id
      WHERE pb.project_id = ?
      ORDER BY pb.relevance_score DESC
    `
    return this.query(sql, [projectId]) as ProjectChunkWithDetails[]
  }

  /**
   * 根据相关度分数范围查询项目块列表
   * @param projectId 项目 ID
   * @param minScore 最低分数
   * @param maxScore 最高分数
   */
  findByRelevanceScoreRange(projectId: Id, minScore: number, maxScore: number): ProjectChunk[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE project_id = ? AND relevance_score >= ? AND relevance_score <= ? ORDER BY relevance_score DESC`
    return this.query(sql, [projectId, minScore, maxScore])
  }

  /**
   * 检查项目块关联是否存在
   * @param projectId 项目 ID
   * @param chunkId 块 ID
   */
  existsByProjectAndChunk(projectId: Id, chunkId: Id): boolean {
    const sql = `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE project_id = ? AND chunk_id = ?) as exists`
    const stmt = this.db.prepare(sql)
    const result = stmt.get([projectId, chunkId]) as unknown as { exists: number }
    return result?.exists === 1
  }

  /**
   * 删除项目块关联
   * @param field 删除字段 (project_id | chunk_id)
   * @param value1 第一个字段值
   * @param value2 第二个字段值（当 field 为 project_id 且需要指定 chunk_id 时使用）
   */
  deleteBy(field: DeleteByField, value1: Id, value2?: Id): number {
    let sql: string
    let params: unknown[]

    if (field === 'project_id' && value2) {
      sql = `DELETE FROM ${this.tableName} WHERE project_id = ? AND chunk_id = ?`
      params = [value1, value2]
    } else {
      sql = `DELETE FROM ${this.tableName} WHERE ${field} = ?`
      params = [value1]
    }

    const stmt = this.db.prepare(sql)
    const result = stmt.run(params)
    return result.changes
  }

  /**
   * 更新相关度分数
   * @param projectId 项目 ID
   * @param chunkId 块 ID
   * @param score 相关度分数
   */
  updateRelevanceScore(projectId: Id, chunkId: Id, score: number): number {
    const sql = `UPDATE ${this.tableName} SET relevance_score = ?, updated_at = ? WHERE project_id = ? AND chunk_id = ?`
    const stmt = this.db.prepare(sql)
    const result = stmt.run([score, this.getCurrentTimestamp(), projectId, chunkId])
    return result.changes
  }

  /**
   * 批量添加块到项目
   * @param projectId 项目 ID
   * @param chunkIds 块 ID 列表
   * @param relevanceScores 相关度分数列表（可选）
   */
  addChunksToProject(projectId: Id, chunkIds: Id[], relevanceScores?: number[]): void {
    this.transaction(() => {
      const timestamp = this.getCurrentTimestamp()
      for (let i = 0; i < chunkIds.length; i++) {
        const chunkId = chunkIds[i]
        if (!this.existsByProjectAndChunk(projectId, chunkId)) {
          const relevanceScore = relevanceScores?.[i] || 0.0
          this.db.prepare(`
            INSERT INTO ${this.tableName} (project_id, chunk_id, relevance_score, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
          `).run([projectId, chunkId, relevanceScore, timestamp, timestamp])
        }
      }
    })
  }

  /**
   * 从项目批量移除块
   * @param projectId 项目 ID
   * @param chunkIds 块 ID 列表
   */
  removeChunksFromProject(projectId: Id, chunkIds: Id[]): void {
    this.transaction(() => {
      for (const chunkId of chunkIds) {
        this.deleteBy('project_id', projectId, chunkId)
      }
    })
  }

  /**
   * 根据指定字段统计项目块关联数量
   * @param field 统计字段 (project_id | chunk_id)
   * @param value 字段值
   */
  countBy(field: CountByField, value: Id): number {
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${field} = ?`
    const result = this.queryOne(sql, [value]) as unknown as { count: number }
    return result?.count || 0
  }

  /**
   * 获取项目的平均相关度分数
   * @param projectId 项目 ID
   */
  getAverageRelevance(projectId: Id): number {
    const sql = `SELECT AVG(relevance_score) as avg_score FROM ${this.tableName} WHERE project_id = ?`
    const result = this.queryOne(sql, [projectId]) as unknown as { avg_score: number }
    return result?.avg_score || 0.0
  }

  /**
   * 构建 WHERE 子句
   * @param conditions 查询条件
   */
  protected buildWhereClause(conditions: ProjectChunkQuery): { sql: string; values: unknown[] } {
    const conditionsArray: string[] = []
    const values: unknown[] = []

    if (conditions.project_id !== undefined) {
      conditionsArray.push('project_id = ?')
      values.push(conditions.project_id)
    }
    if (conditions.chunk_id !== undefined) {
      conditionsArray.push('chunk_id = ?')
      values.push(conditions.chunk_id)
    }
    if (conditions.relevance_score_min !== undefined) {
      conditionsArray.push('relevance_score >= ?')
      values.push(conditions.relevance_score_min)
    }
    if (conditions.relevance_score_max !== undefined) {
      conditionsArray.push('relevance_score <= ?')
      values.push(conditions.relevance_score_max)
    }

    const sql = conditionsArray.length > 0 ? conditionsArray.join(' AND ') : '1=1'
    return { sql, values }
  }
}