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

/**
 * 智能任务的阶段标记列。
 * SET 子句里的列名只能取自这个联合类型（字面量联合，编译期即白名单），
 * 不接受调用方传来的任意字符串，避免 SQL 注入面。
 */
export type ChunkStageColumn =
  | "last_summary_generated_at"
  | "last_smart_processed_at"
  | "last_vectorized_at"
  | "last_concept_extracted_at"
  | "last_linked_at";

/**
 * 差异同步可作用的归属维度列。
 * 与 {@link ChunkStageColumn} 同理：列名只取自这个字面量联合（编译期即白名单），
 * 由 syncByFile / syncByEntry 两个公开入口传入，不接受调用方字符串，无 SQL 注入面。
 */
export type ChunkScopeColumn = "file_id" | "entry_id";

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
   * 记录智能任务的阶段完成标记（时间取当前，与 `updated_at` 同为 ISO 格式）。
   *
   * 只写标记列与可选的时间热度分，**不刷新 `updated_at`**：各任务的增量选取条件
   * 正是 `updated_at > last_xxx_at`，若写标记本身把水位线顶到标记之后，该块会在
   * 下一轮被自己重新选中，永远收敛不了（同 {@link recomputeTemporalScores} 的理由）。
   *
   * @param chunkId 语义块 id
   * @param columns 本轮完成的阶段列（重复列只取一次）
   * @param temporalScore 可选，顺带写入的时间热度分
   * @returns 受影响行数
   */
  recordStage(
    chunkId: string,
    columns: readonly ChunkStageColumn[],
    temporalScore?: number,
  ): number {
    if (!chunkId) return 0;
    const { sets, values } = this.buildStageSets(columns, temporalScore);
    if (sets.length === 0) return 0;

    return this.execute(
      `UPDATE ${this.tableName} SET ${sets.join(", ")} WHERE id = ?`,
      [...values, chunkId],
    ).changes;
  }

  /**
   * {@link recordStage} 的批量版本：一批块只发一条 UPDATE。
   *
   * 向量化按批写标记，逐块写即每块一条 SQL。不支持 temporal_score（热度分按块算）。
   */
  recordStageBatch(
    chunkIds: readonly string[],
    columns: readonly ChunkStageColumn[],
  ): number {
    if (chunkIds.length === 0) return 0;
    const { sets, values } = this.buildStageSets(columns);
    if (sets.length === 0) return 0;

    const placeholders = chunkIds.map(() => "?").join(", ");
    return this.execute(
      `UPDATE ${this.tableName} SET ${sets.join(", ")} WHERE id IN (${placeholders})`,
      [...values, ...chunkIds],
    ).changes;
  }

  /** 拼接阶段标记的 SET 子句；列名只来自 ChunkStageColumn 联合类型 */
  private buildStageSets(
    columns: readonly ChunkStageColumn[],
    temporalScore?: number,
  ): { sets: string[]; values: unknown[] } {
    const timestamp = this.getCurrentTimestamp();
    const sets: string[] = [];
    const values: unknown[] = [];

    for (const column of new Set(columns)) {
      sets.push(`${column} = ?`);
      values.push(timestamp);
    }
    if (temporalScore !== undefined) {
      sets.push("temporal_score = ?");
      values.push(temporalScore);
    }

    return { sets, values };
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
   * 按 `content_hash` 对齐，差异同步某个归属维度下的语义块（事务内原子执行）。
   *
   * 与「全删全建」的差别就是这条链路的成本中心：正文未变的块**复用原 id**，
   * 于是它的 `ai_summary`、LanceDB 向量行、`project_chunks` / `concept_chunks`
   * 归属和 `semantic_links` 全部继续有效——改一个字不再重烧整个归属的 LLM 摘要。
   *
   * 关联清理范围从「整个归属」缩到「真正消失的块」：`semantic_links` /
   * `temporal_events` 对 `semantic_chunks(id)` 的外键**未声明 ON DELETE CASCADE**，
   * 硬删除前必须显式清理，否则外键约束报错；其余关联表已声明级联。
   * 已被软删除（`status = 'deleted'`）的行不参与配对：它不该被复活，
   * 留给清理任务按既有策略物理删除。
   *
   * 归属维度由 `scopeColumn` 决定（`file_id` 或 `entry_id`），两个公开入口
   * {@link syncByFile} / {@link syncByEntry} 复用同一算法，语义逐字节一致：
   * 同样按 content_hash 多重集配对、复用只动行区间不动 content/摘要/阶段标记、
   * 同样以 removeChunksWithRelations 收尾、返回同一 ChunkSyncResult 形态。
   *
   * @param scopeColumn 归属维度列（取自 ChunkScopeColumn 字面量联合，即白名单，无注入面）
   * @param scopeId 该维度下的记录 ID（semantic_chunks.&lt;scopeColumn&gt;）
   * @param chunks 新切分结果（每条含 file_id / file_path / 行号 / 正文 / content_hash；
   *   entry 维度时由调用方额外写入 entry_id）
   * @returns 复用 / 新写数量、消失块 id 与总数
   */
  private syncWithinScope(
    scopeColumn: ChunkScopeColumn,
    scopeId: ChunkId,
    chunks: ChunkCreate[],
  ): ChunkSyncResult {
    if (!scopeId) {
      return { reused: 0, inserted: 0, removedIds: [], total: chunks.length };
    }

    return this.transaction(() =>
      this.withFtsDeferred(() => {
        const existing = this.query(
          `SELECT id, content_hash FROM ${this.tableName} WHERE ${scopeColumn} = ? AND status = 'active'`,
          [scopeId],
        ) as Array<{ id: string; content_hash: string | null }>;

        // 同一归属里 content_hash 可重复（重叠块、重复引用句），
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
          // 也不动 ai_summary / 各阶段标记 —— 它们的派生依据仍然成立。
          // 这里必须绕过 BaseDao.update（它会刷新 updated_at）：智能任务按
          // `updated_at > 阶段标记` 增量选取，刷新水位线会让改一个字的那个归属
          // 里所有未变的块被重新抽取概念、重新向量化。
          this.execute(
            `UPDATE ${this.tableName}
             SET file_path = ?, start_line = ?, end_line = ?, section_title = ?, word_count = ?
             WHERE id = ?`,
            [
              chunk.file_path,
              chunk.start_line,
              chunk.end_line,
              chunk.section_title ?? null,
              chunk.word_count ?? null,
              reuseId,
            ],
          );
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
   * 文件维度差异同步（{@link syncWithinScope} 的公开入口，配对与删除范围 = `file_id`）。
   *
   * @param fileId 文件索引 ID（file_index.id，对应 semantic_chunks.file_id）
   * @param chunks 新切分结果（每条含 file_id / file_path / 行号 / 正文 / content_hash）
   */
  syncByFile(fileId: ChunkId, chunks: ChunkCreate[]): ChunkSyncResult {
    return this.syncWithinScope("file_id", fileId, chunks);
  }

  /**
   * 日志条目维度差异同步（{@link syncWithinScope} 的公开入口，配对与删除范围 = `entry_id`）。
   *
   * 与 {@link syncByFile} 完全对称，唯一差异是把配对与删除归属的列从 `file_id`
   * 换成 `entry_id`（spec §7 条目化切块）：编辑某条日志只重切这一条，未变条目
   * 复用原块 id，其摘要 / 向量 / 概念归属随 id 保留。
   * 传入的 chunk 记录需自带 `entry_id`（由调用方写入）。
   *
   * @param entryId 日志条目 ID（journal_entries.id，对应 semantic_chunks.entry_id）
   * @param chunks 新切分结果（每条含 entry_id / file_id / file_path / 行号 / 正文 / content_hash）
   */
  syncByEntry(entryId: ChunkId, chunks: ChunkCreate[]): ChunkSyncResult {
    return this.syncWithinScope("entry_id", entryId, chunks);
  }

  /**
   * 清掉某日志日文件下「文件级」的旧版语义块（整篇切分产物），返回被删块 id 供向量层清理。
   *
   * 触发时机：旧版整篇 `.md` 被条目接管（导入 / 首次追加）之后——真源已换成 `journal_entries`，
   * 这些按整篇切出来的块再也无人重切（`processFile` 对接管文件让位），留着就是永远可被检索命中的陈旧副本。
   *
   * 范围严格限定 `chunk_type = 'journal' AND entry_id IS NULL AND file_id = ?`：
   * 条目块**同样携带 file_id**（spec §7 的配对依据），若按文件维度全删（`syncByFile(fileId, [])`）
   * 会把刚接管的条目块一起销毁。`chunk_type` 条件保证不越界碰到作品页面块。
   *
   * @param fileId 当日文件的 file_index.id
   * @returns 被硬删除的块 id（事务内已清好未级联的外键引用与 FTS）
   */
  removeFileLevelJournalChunks(fileId: ChunkId): ChunkId[] {
    if (!fileId) return [];

    return this.transaction(() => {
      const rows = this.query(
        `SELECT id FROM ${this.tableName}
         WHERE chunk_type = 'journal' AND entry_id IS NULL AND file_id = ?`,
        [fileId],
      ) as Array<{ id: string }>;
      const removedIds = rows.map((row) => row.id);
      // 无事可做了就别惊动全表 FTS 重建（接管常常发生在从没切过块的老文件上）
      if (removedIds.length === 0) return removedIds;

      this.withFtsDeferred(() => this.removeChunksWithRelations(removedIds));
      return removedIds;
    });
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
