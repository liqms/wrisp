
import { BaseDao } from './base.dao'
import { generateId, normalizeConceptTitle } from '@/shared/utils'
import {
  Concept,
  ConceptCreate,
  ConceptUpdate,
  ConceptQuery,
  ConceptId,
  Name,
  ConceptWithBlocks,
  Id
} from '@/main/types/db'

/** concepts_fts 索引的列：仅当这些列变化时才需要重建索引 */
const FTS_INDEXED_FIELDS = ['title', 'evolving_summary'] as const

/** 概念幂等合并的入参（§3.1.3 阶段 2 串行落库使用） */
export interface ConceptUpsertInput {
  /** normalizeConceptTitle 的结果，唯一索引列 */
  titleKey: string
  title: string
  /** 本轮新增别名，落库前与既有 aliases 求并集 */
  aliases: string[]
  /** 本轮新增提及次数 */
  mentionDelta: number
  /** 概念级关联度（本轮提及的平均把握度） */
  relevance: number
}

export class ConceptDao extends BaseDao<Concept, ConceptCreate, ConceptUpdate> {
  constructor() {
    super('concepts')
  }

  /** 参与概念全文索引的列 */
  protected get ftsIndexedFields(): readonly string[] {
    return FTS_INDEXED_FIELDS
  }

  /** 供迁移等表级批量写入后显式重建 external-content FTS 索引 */
  public rebuildFtsIndex(): void {
    this.rebuildFts()
  }

  /**
   * 按归一化键查询概念（幂等合并依据）
   */
  findByTitleKey(titleKey: string): Concept | null {
    const sql = `SELECT * FROM ${this.tableName} WHERE title_key = ?`
    return this.queryOne(sql, [titleKey])
  }

  /**
   * 取最近更新的概念标题，作为抽取 prompt 的「已有概念」候选池。
   * 首轮没有向量召回可用时，靠这份列表让模型复用既有写法。
   */
  recentTitles(limit: number): string[] {
    const sql = `SELECT title FROM ${this.tableName} ORDER BY updated_at DESC LIMIT ?`
    const rows = this.query(sql, [limit]) as unknown as { title: string }[]
    return rows.map((row) => row.title)
  }

  /**
   * 按 title_key 创建或合并概念。
   *
   * 调用方是块级抽取结束后的**串行**落库阶段，读-改-写之间无并发；
   * 仍写成单条 upsert 是为了让 UNIQUE(title_key) 在任何意外并发下
   * 表现为合并而非重复行。
   * @returns 概念 id 与是否命中既有概念
   */
  upsertByTitleKey(input: ConceptUpsertInput): { id: string; merged: boolean } {
    const timestamp = this.getCurrentTimestamp()
    const existing = this.findByTitleKey(input.titleKey)
    const aliases = JSON.stringify(existing ? this.mergeAliases(existing.aliases, input.aliases) : input.aliases)

    const sql = `
      INSERT INTO ${this.tableName}
        (id, title, title_key, aliases, mention_count, relevance, evolving_summary, timeline, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL, '[]', ?, ?)
      ON CONFLICT(title_key) DO UPDATE SET
        aliases = excluded.aliases,
        relevance = excluded.relevance,
        updated_at = excluded.updated_at
    `
    // mention_count 故意不参与累加：它是 concept_chunks 的行数（派生值），
    // 由 syncMentionCount 在关联写完后重算。累加式在重抽轮里会翻倍。
    this.db.prepare(sql).run([
      existing?.id ?? generateId(),
      input.title,
      input.titleKey,
      aliases,
      input.mentionDelta,
      input.relevance,
      timestamp,
      timestamp,
    ])

    const saved = this.findByTitleKey(input.titleKey)
    return { id: saved?.id ?? existing?.id ?? '', merged: !!existing }
  }

  /**
   * 用关联表实际行数校准 mention_count。
   *
   * 概念会被重复抽取（0.5.0 去重后的一次全量重抽、失败条目重试），
   * `concept_chunks` 靠 ON CONFLICT 幂等，而累加的计数会一轮翻一倍。
   * 以关联表为准重算，「跑 N 轮」与「跑 1 轮」得到同一个数。
   * 不刷新 updated_at：它已被本轮 upsert 顶过，重算只是对齐派生列。
   */
  syncMentionCount(conceptId: string): number {
    if (!conceptId) return 0
    const sql = `
      UPDATE ${this.tableName}
      SET mention_count = (SELECT COUNT(*) FROM concept_chunks WHERE concept_id = ${this.tableName}.id)
      WHERE id = ?
    `
    return this.execute(sql, [conceptId]).changes
  }

  /** 别名并集：按归一化键去重，保留首次出现的写法 */
  private mergeAliases(existingRaw: string | null, incoming: string[]): string[] {
    const merged: string[] = []
    const seen = new Set<string>()
    for (const alias of [...this.parseAliases(existingRaw), ...incoming]) {
      const key = normalizeConceptTitle(alias)
      if (!key || seen.has(key)) continue
      seen.add(key)
      merged.push(alias)
    }
    return merged
  }

  private parseAliases(raw: string | null): string[] {
    if (!raw) return []
    try {
      const value: unknown = JSON.parse(raw)
      return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
    } catch {
      return []
    }
  }

  /**
   * 全文搜索概念（FTS5 trigram 子串匹配，中文可用）
   * 关键词 >= 3 字符时走 concepts_fts 索引；不足 3 字符时回退 LIKE 子串匹配。
   * @param query 搜索关键词
   * @param limit 返回结果数量限制
   */
  searchFts(query: string, limit: number = 50): Concept[] {
    const phrase = this.buildFtsPhrase(query)
    if (phrase) {
      const sql = `
        SELECT c.* FROM ${this.tableName} c
        JOIN ${this.tableName}_fts ON ${this.tableName}_fts.rowid = c.rowid
        WHERE ${this.tableName}_fts MATCH ?
        ORDER BY c.created_at DESC
        LIMIT ?
      `
      return this.query(sql, [phrase, limit])
    }

    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE title LIKE ? ESCAPE '\\' OR evolving_summary LIKE ? ESCAPE '\\'
      ORDER BY created_at DESC
      LIMIT ?
    `
    const pattern = this.buildLikePattern(query)
    return this.query(sql, [pattern, pattern, limit])
  }

  /**
   * 根据标题查询概念
   * @param title 概念标题
   */
  findByTitle(title: Name): Concept | null {
    const sql = `SELECT * FROM ${this.tableName} WHERE title = ?`
    return this.queryOne(sql, [title])
  }

  /**
   * 根据标题模糊查询概念列表
   * @param title 标题关键词
   */
  findByTitleLike(title: string): Concept[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE title LIKE ? ORDER BY title ASC`
    return this.query(sql, [`%${title}%`])
  }

  /**
   * 根据关联度范围查询概念列表
   * @param minRelevance 最低关联度（默认 0）
   * @param maxRelevance 最高关联度（可选）
   */
  findByRelevanceRange(minRelevance: number = 0, maxRelevance?: number): Concept[] {
    let sql: string
    let params: unknown[]

    if (maxRelevance !== undefined) {
      sql = `SELECT * FROM ${this.tableName} WHERE relevance >= ? AND relevance <= ? ORDER BY relevance DESC`
      params = [minRelevance, maxRelevance]
    } else {
      sql = `SELECT * FROM ${this.tableName} WHERE relevance >= ? ORDER BY relevance DESC`
      params = [minRelevance]
    }

    return this.query(sql, params)
  }

  /**
   * 获取概念及其关联的 chunk 数量
   * @param id 概念 ID
   */
  findWithBlocks(id: ConceptId): ConceptWithBlocks | null {
    const sql = `
      SELECT c.*, 
             COALESCE(bc.block_count, 0) as block_count,
             json_group_array(sc.content) as linked_block_contents
      FROM ${this.tableName} c
      LEFT JOIN (
        SELECT concept_id, chunk_id, COUNT(*) as block_count
        FROM concept_chunks
        WHERE concept_id = ?
        GROUP BY concept_id
      ) bc ON c.id = bc.concept_id
      LEFT JOIN concept_chunks cc ON c.id = cc.concept_id
      LEFT JOIN semantic_chunks sc ON cc.chunk_id = sc.id
      WHERE c.id = ?
      GROUP BY c.id
    `
    return this.queryOne(sql, [id, id]) as ConceptWithBlocks | null
  }

  /**
   * 更新概念的关联度
   * @param id 概念 ID
   * @param relevance 关联度
   */
  updateRelevance(id: string, relevance: number): number {
    const sql = `UPDATE ${this.tableName} SET relevance = ?, updated_at = ? WHERE id = ?`
    const stmt = this.db.prepare(sql)
    const result = stmt.run([relevance, this.getCurrentTimestamp(), id])
    return result.changes
  }

  /**
   * 根据关联的 chunk ID 查询概念列表
   * @param chunkId chunk ID
   */
  findByLinkedBlock(chunkId: Id): Concept[] {
    const sql = `
      SELECT c.* 
      FROM ${this.tableName} c
      JOIN concept_chunks cc ON c.id = cc.concept_id
      WHERE cc.chunk_id = ?
      ORDER BY cc.relevance_score DESC
    `
    return this.query(sql, [chunkId])
  }

  /**
   * 检查标题是否已存在
   * @param title 概念标题
   * @param excludeId 排除的概念 ID（用于更新时检查）
   */
  checkTitleExists(title: Name, excludeId?: ConceptId): boolean {
    let sql = `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE title = ?`
    const params: unknown[] = [title]

    if (excludeId) {
      sql += ' AND id != ?)'
      params.push(excludeId)
    } else {
      sql += ')'
    }

    const stmt = this.db.prepare(sql)
    const result = stmt.get(params) as { exists: number }
    return result?.exists === 1
  }

  /**
   * 构建 WHERE 子句
   * @param conditions 查询条件
   */
  protected buildWhereClause(conditions: ConceptQuery): { sql: string; values: unknown[] } {
    const conditionsArray: string[] = []
    const values: unknown[] = []

    if (conditions.title !== undefined) {
      conditionsArray.push('title = ?')
      values.push(conditions.title)
    }
    if (conditions.relevance_min !== undefined) {
      conditionsArray.push('relevance >= ?')
      values.push(conditions.relevance_min)
    }
    if (conditions.relevance_max !== undefined) {
      conditionsArray.push('relevance <= ?')
      values.push(conditions.relevance_max)
    }

    const sql = conditionsArray.length > 0 ? conditionsArray.join(' AND ') : '1=1'
    return { sql, values }
  }
}

export const conceptDao = new ConceptDao()
