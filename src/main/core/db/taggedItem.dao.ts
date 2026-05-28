import { BaseDao } from './base.dao'
import {
  TaggedItem,
  TaggedItemCreate,
  TaggedItemUpdate,
  TaggedItemQuery,
  EntityType,
  Id,
} from '@/main/types/db'

type DeleteByField = 'tag_id' | 'entity_type'
type CountByField = 'tag_id' | 'entity_type'

export class TaggedItemDao extends BaseDao<TaggedItem, TaggedItemCreate, TaggedItemUpdate> {
  constructor() {
    super('tagged_items')
  }

  /**
   * 根据标签 ID 查询关联记录
   * @param tagId 标签 ID
   */
  findByTagId(tagId: string): TaggedItem[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE tag_id = ? ORDER BY added_at DESC`
    return this.query(sql, [tagId])
  }

  /**
   * 根据实体类型和实体 ID 查询关联记录
   * @param entityType 实体类型
   * @param entityId 实体 ID
   */
  findByEntity(entityType: EntityType, entityId: string): TaggedItem[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE entity_type = ? AND entity_id = ? ORDER BY added_at DESC`
    return this.query(sql, [entityType, entityId])
  }

  /**
   * 根据实体类型查询关联记录
   * @param entityType 实体类型
   */
  findByEntityType(entityType: EntityType): TaggedItem[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE entity_type = ? ORDER BY added_at DESC`
    return this.query(sql, [entityType])
  }

  /**
   * 获取实体关联的标签 ID 列表
   * @param entityType 实体类型
   * @param entityId 实体 ID
   */
  findTagIdsByEntity(entityType: EntityType, entityId: string): string[] {
    const sql = `SELECT tag_id FROM ${this.tableName} WHERE entity_type = ? AND entity_id = ?`
    const result = this.query(sql, [entityType, entityId]) as { tag_id: string }[]
    return result.map(item => item.tag_id)
  }

  /**
   * 获取标签关联的实体 ID 列表
   * @param tagId 标签 ID
   * @param entityType 实体类型过滤（可选）
   */
  findEntityIdsByTag(tagId: string, entityType?: EntityType): string[] {
    let sql: string
    let params: unknown[] = [tagId]

    if (entityType) {
      sql = `SELECT entity_id FROM ${this.tableName} WHERE tag_id = ? AND entity_type = ?`
      params.push(entityType)
    } else {
      sql = `SELECT entity_id FROM ${this.tableName} WHERE tag_id = ?`
    }

    const result = this.query(sql, params) as { entity_id: string }[]
    return result.map(item => item.entity_id)
  }

  /**
   * 检查标签与实体的关联是否存在
   * @param tagId 标签 ID
   * @param entityType 实体类型
   * @param entityId 实体 ID
   */
  existsByTagAndEntity(tagId: Id, entityType: EntityType, entityId: string): boolean {
    const sql = `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE tag_id = ? AND entity_type = ? AND entity_id = ?) as exists`
    const stmt = this.db.prepare(sql)
    const result = stmt.get([tagId, entityType, entityId]) as unknown as { exists: number }
    return result?.exists === 1
  }

  /**
   * 删除关联记录
   * @param field 删除字段 (tag_id | entity_type)
   * @param value1 字段值
   * @param value2 额外条件值（当 field 为 entity_type 且需要指定 entity_id 时使用）
   */
  deleteBy(field: DeleteByField, value1: Id | EntityType, value2?: string): number {
    let sql: string
    let params: unknown[]

    if (field === 'entity_type' && value2) {
      sql = `DELETE FROM ${this.tableName} WHERE entity_type = ? AND entity_id = ?`
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
   * 批量添加标签到实体
   * @param entityType 实体类型
   * @param entityId 实体 ID
   * @param tagIds 标签 ID 列表
   */
  addTagsToEntity(entityType: EntityType, entityId: string, tagIds: string[]): void {
    this.transaction(() => {
      for (const tagId of tagIds) {
        if (!this.existsByTagAndEntity(tagId, entityType, entityId)) {
          this.create({
            tag_id: tagId,
            entity_type: entityType,
            entity_id: entityId
          })
        }
      }
    })
  }

  /**
   * 从实体移除指定标签
   * @param entityType 实体类型
   * @param entityId 实体 ID
   * @param tagIds 标签 ID 列表
   */
  removeTagsFromEntity(entityType: EntityType, entityId: string, tagIds: string[]): void {
    this.transaction(() => {
      for (const tagId of tagIds) {
        const sql = `DELETE FROM ${this.tableName} WHERE tag_id = ? AND entity_type = ? AND entity_id = ?`
        this.db.prepare(sql).run([tagId, entityType, entityId])
      }
    })
  }

  /**
   * 替换实体的标签（先删除现有标签，再添加新标签）
   * @param entityType 实体类型
   * @param entityId 实体 ID
   * @param tagIds 新的标签 ID 列表
   */
  replaceTagsForEntity(entityType: EntityType, entityId: string, tagIds: string[]): void {
    this.transaction(() => {
      this.deleteBy('entity_type', entityType, entityId)
      this.addTagsToEntity(entityType, entityId, tagIds)
    })
  }

  /**
   * 根据指定字段统计关联记录数量
   * @param field 统计字段 (tag_id | entity_type)
   * @param value 字段值
   */
  countBy(field: CountByField, value: string | EntityType): number {
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE ${field} = ?`
    const result = this.queryOne(sql, [value]) as unknown as { count: number }
    return result?.count || 0
  }

  /**
   * 构建 WHERE 子句
   * @param conditions 查询条件
   */
  protected buildWhereClause(conditions: TaggedItemQuery): { sql: string; values: unknown[] } {
    const conditionsArray: string[] = []
    const values: unknown[] = []

    if (conditions.tag_id !== undefined) {
      conditionsArray.push('tag_id = ?')
      values.push(conditions.tag_id)
    }
    if (conditions.entity_type !== undefined) {
      conditionsArray.push('entity_type = ?')
      values.push(conditions.entity_type)
    }
    if (conditions.entity_id !== undefined) {
      conditionsArray.push('entity_id = ?')
      values.push(conditions.entity_id)
    }

    const sql = conditionsArray.length > 0 ? conditionsArray.join(' AND ') : '1=1'
    return { sql, values }
  }
}