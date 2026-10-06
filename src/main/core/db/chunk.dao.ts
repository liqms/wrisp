import { BaseDao } from "./base.dao";
import {
  Chunk,
  ChunkCreate,
  ChunkUpdate,
  ChunkQuery,
  ChunkId,
  ChunkStatus,
  ChunkSyncResult,
  BooleanFlag,
} from "@/main/types/db";

/** semantic_chunks_fts 索引的列：仅当这些列变化时才需要重建索引 */
const FTS_INDEXED_FIELDS = ["content", "ai_summary"] as const;

/** 批量硬删除时单条 SQL 绑定的 id 数上限（远低于 SQLite 参数上限，留足 IN 两侧余量） */
const CHUNK_DELETE_BATCH_SIZE = 500;

export class ChunkDao extends BaseDao<Chunk, ChunkCreate, ChunkUpdate> {
  constructor() {
    super("semantic_chunks");
  }

  /** 参与语义块全文索引的列 */
  protected get ftsIndexedFields(): readonly string[] {
    return FTS_INDEXED_FIELDS;
  }

  /**
   * 重建语义块全文索引（semantic_chunks_fts）。
   * 公开给 journal.service —— 它用原始 SQL 清空 semantic_chunks，绕过了 DAO 的维护逻辑。
   * 索引与重建策略详见 BaseDao.rebuildFts / refreshFts。
   */
  public rebuildFts(): void {
    super.rebuildFts();
  }

  /**
   * 根据时间衰减分数范围查询 Chunk 列表
   * @param minScore 最低分数
   * @param maxScore 最高分数
   */
  findWithTemporalScoreRange(minScore: number, maxScore: number): Chunk[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE temporal_score >= ? AND temporal_score <= ? ORDER BY temporal_score DESC`;
    return this.query(sql, [minScore, maxScore]);
  }

  /**
   * 全文搜索 Chunk（FTS5 trigram 子串匹配，中文可用）。
   * 关键词 >= 3 字符时走 semantic_chunks_fts 索引；
   * 不足 3 字符时 trigram 无法命中，回退 LIKE 子串匹配。
   * @param query 搜索关键词
   * @param limit 返回结果数量限制
   */
  searchFts(query: string, limit: number = 50): Chunk[] {
    const phrase = this.buildFtsPhrase(query);
    if (phrase) {
      const sql = `
        SELECT c.* FROM ${this.tableName} c
        JOIN ${this.tableName}_fts ON ${this.tableName}_fts.rowid = c.rowid
        WHERE c.status = 'active' AND ${this.tableName}_fts MATCH ?
        ORDER BY c.created_at DESC
        LIMIT ?
      `;
      return this.query(sql, [phrase, limit]);
    }

    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE status = 'active' AND (content LIKE ? ESCAPE '\\' OR ai_summary LIKE ? ESCAPE '\\')
      ORDER BY created_at DESC
      LIMIT ?
    `;
    const pattern = this.buildLikePattern(query);
    return this.query(sql, [pattern, pattern, limit]);
  }

  /**
   * 获取最近的 Chunk 列表
   * @param limit 返回结果数量限制
   */
  getRecentChunks(limit: number = 50): Chunk[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE status = 'active' ORDER BY created_at DESC LIMIT ?`;
    return this.query(sql, [limit]);
  }

  /**
   * 根据日期范围查询 Chunk 列表
   * 按 created_at ASC 排序
   * @param startDate 起始日期（ISO 8601 字符串）
   * @param endDate 结束日期（ISO 8601 字符串）
   * @param status 可选的 chunk 状态过滤
   *   - undefined：查询所有 chunk
   *   - 具体状态：查询指定状态的 chunk
   */
  findByDateRange(
    startDate: string,
    endDate: string,
    status?: ChunkStatus,
  ): Chunk[] {
    let sql: string;
    const params: unknown[] = [startDate, endDate];

    if (status !== undefined) {
      sql = `SELECT * FROM ${this.tableName} WHERE created_at >= ? AND created_at <= ? AND status = ? ORDER BY created_at DESC`;
      params.push(status);
    } else {
      sql = `SELECT * FROM ${this.tableName} WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC`;
    }

    return this.query(sql, params);
  }

  /**
   * 按时间衰减分数排序获取 Chunk 列表
   * @param limit 返回结果数量限制
   */
  getChunksWithTemporalScore(limit: number = 50): Chunk[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE status = 'active' ORDER BY temporal_score DESC LIMIT ?`;
    return this.query(sql, [limit]);
  }

  /**
   * 设置 Chunk 的字数
   * @param id Chunk ID
   * @param count 字数
   */
  setWordCount(id: string, count: number): number {
    const sql = `UPDATE ${this.tableName} SET word_count = ?, updated_at = ? WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    const result = stmt.run([count, this.getCurrentTimestamp(), id]);
    return result.changes;
  }

  /**
   * 更新 Chunk 的时间衰减分数
   * @param id Chunk ID
   * @param score 时间衰减分数
   */
  updateTemporalScore(id: string, score: number): number {
    const sql = `UPDATE ${this.tableName} SET temporal_score = ?, updated_at = ? WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    const result = stmt.run([score, this.getCurrentTimestamp(), id]);
    return result.changes;
  }

  /**
   * 批量重算全表语义块的时间热度分（事务内原子执行）。
   *
   * 只写 `temporal_score`，**不更新 `updated_at`** —— 智能任务以 `updated_at`
   * 作为增量水位线，若此处刷新会污染水位线，导致下次整理误判全表为「新变更」。
   *
   * @param scoreFn 单块计分函数（入参为 created_at，返回 [0,1] 热度分）
   * @returns 实际更新的行数
   */
  recomputeTemporalScores(scoreFn: (createdAt: string) => number): number {
    return this.transaction(() => {
      const rows = this.query(`SELECT id, created_at FROM ${this.tableName}`) as Array<{
        id: string;
        created_at: string;
      }>;
      const stmt = this.db.prepare(
        `UPDATE ${this.tableName} SET temporal_score = ? WHERE id = ?`,
      );
      let changes = 0;
      for (const row of rows) {
        changes += stmt.run([scoreFn(row.created_at), row.id]).changes;
      }
      return changes;
    });
  }

  /**
   * 设置单个 Chunk 的软删除状态（独立方法，不注册 IPC）
   * @param id Chunk ID
   * @param isDeleted 是否删除 (0 | 1)
   */
  setDeleted(id: ChunkId, isDeleted: BooleanFlag): number {
    if (!id || id.trim() === "") return 0;
    const safeValue: number = isDeleted ? 1 : 0;
    const sql = `UPDATE ${this.tableName} SET status = ?, updated_at = ? WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    const result = stmt.run([safeValue, this.getCurrentTimestamp(), id]);
    return result.changes;
  }

  /**
   * 批量设置 Chunk 的删除状态（独立方法，不注册 IPC）
   * 在事务中执行，确保原子性
   * @param ids Chunk ID 数组
   * @param isDeleted 是否删除 (0 | 1)
   * @returns 实际受影响的行数
   */
  setDeletedBatch(ids: ChunkId[], isDeleted: BooleanFlag): number {
    if (!ids || ids.length === 0) return 0;
    const safeValue: number = isDeleted ? 1 : 0;
    return this.transaction(() => {
      const placeholders = ids.map(() => "?").join(", ");
      const sql = `UPDATE ${this.tableName} SET is_deleted = ?, updated_at = ? WHERE id IN (${placeholders})`;
      const stmt = this.db.prepare(sql);
      const result = stmt.run([safeValue, this.getCurrentTimestamp(), ...ids]);
      return result.changes;
    });
  }

  /**
   * 按 `content_hash` 对齐，差异同步某个文件的语义块（事务内原子执行）。
   *
   * 与「全删全建」的差别就是这条链路的成本中心：正文未变的块**复用原 id**，
   * 于是它的 `ai_summary`、LanceDB 向量行、`project_chunks` / `concept_chunks`
   * 归属和 `semantic_links` 全部继续有效——改一个字不再重烧整个文件的 LLM 摘要。
   *
   * 关联清理范围从「整文件」缩到「真正消失的块」：`semantic_links` /
   * `temporal_events` 对 `semantic_chunks(id)` 的外键**未声明 ON DELETE CASCADE**，
   * 硬删除前必须显式清理，否则外键约束报错；其余关联表已声明级联。
   * 已被软删除（`status = 'deleted'`）的行不参与配对：它不该被复活，
   * 留给清理任务按既有策略物理删除。
   *
   * @param fileId 文件索引 ID（semantic_chunks.file_id）
   * @param chunks 新切分结果（每条含 file_id / file_path / 行号 / 正文 / content_hash）
   * @returns 复用 / 新写数量、消失块 id 与总数
   */
  syncByFile(fileId: ChunkId, chunks: ChunkCreate[]): ChunkSyncResult {
    if (!fileId) {
      return { reused: 0, inserted: 0, removedIds: [], total: chunks.length };
    }

    return this.transaction(() =>
      this.withFtsDeferred(() => {
        const existing = this.query(
          `SELECT id, content_hash FROM ${this.tableName} WHERE file_id = ? AND status = 'active'`,
          [fileId],
        ) as Array<{ id: string; content_hash: string | null }>;

        // 同一文件里 content_hash 可重复（重叠块、重复引用句），
        // 用多重集按出现顺序配对；一次命中的 Map 会让 id 与行区间错配
        const pool = new Map<string, string[]>();
        for (const row of existing) {
          if (!row.content_hash) continue;
          const queue = pool.get(row.content_hash);
          if (queue) queue.push(row.id);
          else pool.set(row.content_hash, [row.id]);
        }

        const reusedIds = new Set<string>();
        for (const chunk of chunks) {
          const reuseId = chunk.content_hash
            ? pool.get(chunk.content_hash)?.shift()
            : undefined;

          if (!reuseId) {
            this.create(chunk);
            continue;
          }

          reusedIds.add(reuseId);
          // 只跟新边界，不动 content：hash 相同即正文相同，重写一遍是纯浪费；
          // 也不动 ai_summary / last_vectorized_at —— 它们的派生依据仍然成立
          this.update(reuseId, {
            file_path: chunk.file_path,
            start_line: chunk.start_line,
            end_line: chunk.end_line,
            section_title: chunk.section_title ?? null,
            word_count: chunk.word_count,
          });
        }

        const removedIds = existing
          .map((row) => row.id)
          .filter((id) => !reusedIds.has(id));
        this.removeChunksWithRelations(removedIds);

        return {
          reused: reusedIds.size,
          inserted: chunks.length - reusedIds.size,
          removedIds,
          total: chunks.length,
        };
      }),
    );
  }

  /**
   * 硬删除一批块，并先清掉未声明级联的外键引用。
   *
   * `IN (...)` 的占位符数量受 SQLite 参数上限约束，按固定批次绑定。
   */
  private removeChunksWithRelations(chunkIds: ChunkId[]): void {
    for (let i = 0; i < chunkIds.length; i += CHUNK_DELETE_BATCH_SIZE) {
      const batch = chunkIds.slice(i, i + CHUNK_DELETE_BATCH_SIZE);
      const placeholders = batch.map(() => "?").join(", ");
      this.execute(
        `DELETE FROM semantic_links WHERE source_chunk_id IN (${placeholders}) OR target_chunk_id IN (${placeholders})`,
        [...batch, ...batch],
      );
      this.execute(
        `DELETE FROM temporal_events WHERE chunk_id IN (${placeholders})`,
        batch,
      );
      // FTS 重建由 syncByFile 的外层作用域统一收尾
      this.deleteByIds(batch);
    }
  }

  /**
   * 构建 WHERE 子句
   * @param conditions 查询条件
   */
  protected buildWhereClause(conditions: ChunkQuery): {
    sql: string;
    values: unknown[];
  } {
    const conditionsArray: string[] = [];
    const values: unknown[] = [];

    if (conditions.status !== undefined) {
      conditionsArray.push("status = ?");
      values.push(conditions.status);
    }
    if (conditions.is_deleted !== undefined) {
      conditionsArray.push("is_deleted = ?");
      values.push(conditions.is_deleted);
    }
    if (conditions.temporal_score_min !== undefined) {
      conditionsArray.push("temporal_score >= ?");
      values.push(conditions.temporal_score_min);
    }
    if (conditions.temporal_score_max !== undefined) {
      conditionsArray.push("temporal_score <= ?");
      values.push(conditions.temporal_score_max);
    }

    const sql =
      conditionsArray.length > 0 ? conditionsArray.join(" AND ") : "1=1";
    return { sql, values };
  }
}
