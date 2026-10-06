import Database from "better-sqlite3";
import { getDatabase } from "./connection";
import { Logger } from "@/main/utils/logger";
import { PaginationResult } from "@/shared/utils/pagination";
import { TimeUtil } from "@/shared/utils";
import { NodeCryptoUtil } from "@/main/utils/crypto";

/**
 * 时间戳配置接口
 */
interface TimestampConfig {
  /** 是否启用自动时间戳 */
  enabled: boolean;
  /** 创建时间字段名 */
  createdAtField?: string;
  /** 更新时间字段名 */
  updatedAtField?: string;
}

/**
 * 数据访问对象基类
 * 提供通用的 CRUD 操作和数据库查询方法
 * @template T - 实体类型
 * @template C - 创建数据类型
 * @template U - 更新数据类型
 */
export abstract class BaseDao<T, C extends object, U extends object> {
  /** 数据库表名 */
  protected tableName: string;

  /** 时间戳配置 */
  protected timestampConfig: TimestampConfig;

  /**
   * 构造函数
   * @param tableName - 数据库表名
   * @param timestampConfig - 时间戳配置，可选
   */
  constructor(
    tableName: string,
    timestampConfig: TimestampConfig = { enabled: true },
  ) {
    this.tableName = tableName;
    this.timestampConfig = {
      enabled: timestampConfig.enabled,
      createdAtField: timestampConfig.createdAtField || "created_at",
      updatedAtField: timestampConfig.updatedAtField || "updated_at",
    };
    this.validateTableName(tableName);
  }

  /**
   * 验证表名是否合法
   * @param tableName - 待验证的表名
   * @throws {Error} 当表名不符合命名规范时抛出错误
   */
  private validateTableName(tableName: string): void {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new Error(`表名无效，只能包含字母、数字和下划线: ${tableName}`);
    }
  }

  /** 表的实际列名集合，首次使用时探测并缓存 */
  private tableColumns: Set<string> | null = null;

  /**
   * 探测表的列名集合
   * 关联表（concept_chunks / topic_chunks / topic_concepts / tagged_items 等）以复合主键为键，
   * 既没有 id 列，也不一定有 created_at / updated_at 列，自动补列必须以真实 schema 为准。
   * @returns 列名集合；表尚未创建（未迁移）时为空集合
   */
  protected getTableColumns(): Set<string> {
    if (this.tableColumns === null) {
      const rows = this.db
        .prepare(`PRAGMA table_info(${this.tableName})`)
        .all() as Array<{ name: string }>;
      this.tableColumns = new Set(rows.map((row) => row.name));
    }
    return this.tableColumns;
  }

  /**
   * 表是否含有指定列
   * @param column - 列名
   */
  protected hasColumn(column: string): boolean {
    return this.getTableColumns().has(column);
  }

  /**
   * 获取数据库连接实例
   * @returns Database.Database 数据库实例
   */
  protected get db(): Database.Database {
    return getDatabase();
  }

  /**
   * 获取当前时间戳
   * @returns ISO 8601 格式的时间戳字符串
   */
  protected getCurrentTimestamp(): string {
    return TimeUtil.toISOString(Date.now());
  }

  /**
   * 增强数据对象，自动添加时间戳字段
   * @param data - 原始数据对象
   * @param isCreate - 是否为创建操作（true: 创建，false: 更新）
   * @returns 增强后的数据对象
   */
  protected enhanceDataWithTimestamps(
    data: C | U,
    isCreate: boolean = true,
  ): C | U {
    if (!this.timestampConfig.enabled) {
      return data;
    }

    const timestamp = this.getCurrentTimestamp();
    const enhancedData = { ...data };

    const assignIfColumn = (field?: string): void => {
      if (field && this.hasColumn(field)) {
        Object.assign(enhancedData, { [field]: timestamp });
      }
    };

    if (isCreate) {
      assignIfColumn(this.timestampConfig.createdAtField);
      assignIfColumn(this.timestampConfig.updatedAtField);
    } else {
      assignIfColumn(this.timestampConfig.updatedAtField);
    }

    return enhancedData;
  }

  /**
   * 序列化值以便 SQLite 绑定
   * SQLite3 只能绑定 numbers, strings, bigints, buffers, null
   * 对象/数组自动 JSON.stringify，布尔转数字
   */
  private serializeForSqlite(value: unknown): unknown {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === "object" || Array.isArray(value)) {
      return JSON.stringify(value);
    }
    if (typeof value === "boolean") {
      return value ? 1 : 0;
    }
    return value;
  }

  /**
   * 创建单条记录
   * 自动补 id 与时间戳前会先核对表的实际列，复合主键关联表（无 id 列）不会被补出多余列
   * @param data - 创建数据对象
   * @returns 新创建记录的 ID（UUID 字符串）；表无 id 列时返回空字符串
   * @throws {Error} 当数据为空或数据库操作失败时抛出错误
   */
  create(data: C): string {
    try {
      const enhancedData = this.enhanceDataWithTimestamps(data, true) as C & {
        id?: string;
      };

      const keys = Object.keys(enhancedData) as (keyof C)[];
      if (keys.length === 0) {
        throw new Error("创建操作需要提供数据");
      }

      if (this.hasColumn("id") && !enhancedData.id) {
        enhancedData.id = NodeCryptoUtil.generateUUID();
        keys.push("id" as keyof C);
      }

      const placeholders = keys.map(() => "?").join(", ");
      const values: unknown[] = keys.map((key) =>
        this.serializeForSqlite(enhancedData[key]),
      );
      const columnNames = keys.map((key) => String(key)).join(", ");

      const sql = `INSERT INTO ${this.tableName} (${columnNames}) VALUES (${placeholders})`;
      Logger.debug(`执行 SQL: ${sql}`, { values: values.length });

      const stmt = this.db.prepare(sql);
      stmt.run(values);

      Logger.debug(`创建记录，id: ${enhancedData.id ?? "(复合主键)"}`, {
        id: enhancedData.id,
      });

      // 主表已变更：本表若声明了 FTS 索引列则重建全文索引
      this.refreshFts();

      return enhancedData.id ?? "";
    } catch (error) {
      Logger.error(`创建记录失败，表名: ${this.tableName}:`, {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * 批量创建记录
   * 在事务中执行多个创建操作，确保原子性
   * @param dataList - 创建数据对象数组
   * @returns 新创建记录的 ID 数组
   */
  createBatch(dataList: C[]): string[] {
    if (dataList.length === 0) {
      return [];
    }

    return this.transaction(() => {
      const ids: string[] = [];
      for (const data of dataList) {
        ids.push(this.create(data));
      }
      return ids;
    });
  }

  /**
   * 根据 ID 查询单条记录
   * @param id - 记录 ID（UUID 字符串）
   * @returns 查询到的记录对象，未找到时返回 null
   */
  findById(id: string): T | null {
    try {
      if (!id || id.trim() === "") {
        return null;
      }

      const sql = `SELECT * FROM ${this.tableName} WHERE id = ?`;
      Logger.debug(`执行 SQL: ${sql}`, { id });

      const stmt = this.db.prepare(sql);
      const result = stmt.get(id) as T | null;

      Logger.debug(`找到记录: ${result ? "yes" : "no"}`);
      return result;
    } catch (error) {
      Logger.error(`根据ID查询记录失败，表名: ${this.tableName}:`, {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * 查询所有记录
   * @returns 所有记录数组
   */
  findAll(): T[] {
    try {
      const sql = `SELECT * FROM ${this.tableName}`;
      Logger.debug(`执行 SQL: ${sql}`);

      const stmt = this.db.prepare(sql);
      const result = stmt.all() as T[];

      Logger.debug(`找到 ${result.length} 条记录`);
      return result;
    } catch (error) {
      Logger.error(`查询所有记录失败，表名: ${this.tableName}:`, {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * 根据 ID 数组批量查询记录
   * @param ids - 记录 ID 数组（UUID 字符串）
   * @returns 查询到的记录数组
   */
  findByIds(ids: string[]): T[] {
    if (ids.length === 0) {
      return [];
    }

    try {
      const placeholders = ids.map(() => "?").join(", ");
      const sql = `SELECT * FROM ${this.tableName} WHERE id IN (${placeholders})`;
      Logger.debug(`执行 SQL: ${sql}`, { ids: ids.length });

      const stmt = this.db.prepare(sql);
      const result = stmt.all(ids) as T[];

      Logger.debug(`找到 ${result.length} 条记录`);
      return result;
    } catch (error) {
      Logger.error(`根据ID查询记录失败，表名: ${this.tableName}:`, {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * 更新单条记录
   * @param id - 记录 ID（UUID 字符串）
   * @param data - 更新数据对象
   * @returns 受影响的行数
   */
  update(id: string, data: U): number {
    try {
      if (!id || id.trim() === "") {
        return 0;
      }

      const enhancedData = this.enhanceDataWithTimestamps(data, false) as U;

      const keys = Object.keys(enhancedData) as (keyof U)[];
      if (keys.length === 0) {
        return 0;
      }

      const updates = keys.map((key) => `${String(key)} = ?`).join(", ");
      const values: unknown[] = keys.map((key) =>
        this.serializeForSqlite(enhancedData[key]),
      );
      values.push(id);

      const sql = `UPDATE ${this.tableName} SET ${updates} WHERE id = ?`;
      Logger.debug(`执行 SQL: ${sql}`, { id, values: values.length - 1 });

      const stmt = this.db.prepare(sql);
      const result = stmt.run(values);

      // 仅当本次更新涉及 FTS 索引列时才重建索引
      if (result.changes > 0) {
        this.refreshFts(enhancedData);
      }

      Logger.debug(`更新 ${result.changes} 条记录`);
      return result.changes;
    } catch (error) {
      Logger.error(`更新记录失败，表名: ${this.tableName}:`, {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * 删除单条记录
   * @param id - 记录 ID（UUID 字符串）
   * @returns 受影响的行数
   */
  delete(id: string): number {
    try {
      if (!id || id.trim() === "") {
        return 0;
      }

      const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
      Logger.debug(`执行 SQL: ${sql}`, { id });

      const stmt = this.db.prepare(sql);
      const result = stmt.run(id);

      // 删除后重建 FTS 索引，避免索引中残留已删除行
      if (result.changes > 0) {
        this.refreshFts();
      }

      Logger.debug(`删除 ${result.changes} 条记录`);
      return result.changes;
    } catch (error) {
      Logger.error(`删除记录失败，表名: ${this.tableName}:`, {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * 根据 ID 数组批量删除记录
   * @param ids - 记录 ID 数组（UUID 字符串）
   * @returns 受影响的行数
   */
  deleteByIds(ids: string[]): number {
    if (ids.length === 0) {
      return 0;
    }

    try {
      const placeholders = ids.map(() => "?").join(", ");
      const sql = `DELETE FROM ${this.tableName} WHERE id IN (${placeholders})`;
      Logger.debug(`执行 SQL: ${sql}`, { ids: ids.length });

      const stmt = this.db.prepare(sql);
      const result = stmt.run(ids);

      // 批量删除后重建 FTS 索引，避免索引中残留已删除行
      if (result.changes > 0) {
        this.refreshFts();
      }

      Logger.debug(`删除 ${result.changes} 条记录`);
      return result.changes;
    } catch (error) {
      Logger.error(`删除记录失败，表名: ${this.tableName}:`, {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * 执行原生 SQL 语句（INSERT/UPDATE/DELETE）
   * @param sql - SQL 语句
   * @param params - SQL 参数数组
   * @returns 执行结果
   */
  execute(sql: string, params?: unknown[]): Database.RunResult {
    try {
      Logger.debug(`执行 SQL: ${sql}`, { params: params?.length || 0 });

      const stmt = this.db.prepare(sql);
      const result = params ? stmt.run(params) : stmt.run();

      Logger.debug(`执行完成，影响 ${result.changes} 条记录`);
      return result;
    } catch (error) {
      Logger.error(`执行 SQL ${sql} 失败`, { error: String(error) });
      throw error;
    }
  }

  /**
   * 执行查询 SQL 并返回多条记录
   * @param sql - SQL 查询语句
   * @param params - SQL 参数数组
   * @returns 查询结果数组
   */
  query(sql: string, params?: unknown[]): T[] {
    try {
      Logger.debug(`查询: ${sql}`, { params: params?.length || 0 });

      const stmt = this.db.prepare(sql);
      const result = params ? (stmt.all(params) as T[]) : (stmt.all() as T[]);

      Logger.debug(`查询完成，找到 ${result.length} 条记录`);
      return result;
    } catch (error) {
      Logger.error(`查询失败，表名: ${this.tableName}:`, {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * 执行查询 SQL 并返回单条记录
   * @param sql - SQL 查询语句
   * @param params - SQL 参数数组
   * @returns 查询结果对象，未找到时返回 null
   */
  queryOne(sql: string, params?: unknown[]): T | null {
    try {
      Logger.debug(`查询: ${sql}`, { params: params?.length || 0 });

      const stmt = this.db.prepare(sql);
      const result = params
        ? (stmt.get(params) as T | null)
        : (stmt.get() as T | null);

      Logger.debug(`查询完成，找到 ${result ? "记录" : "无记录"}`);
      return result;
    } catch (error) {
      Logger.error(`查询失败，表名: ${this.tableName}:`, {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * 统计记录数量
   * @param sql - 可选的 SQL 子查询语句
   * @param params - SQL 参数数组
   * @returns 记录数量
   */
  count(sql?: string, params?: unknown[]): number {
    try {
      let countSql: string;
      let countParams: unknown[] = params || [];

      if (sql) {
        countSql = `SELECT COUNT(*) as count FROM (${sql}) as subquery`;
      } else {
        countSql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
      }

      Logger.debug(`查询: ${countSql}`, { params: countParams.length });

      const stmt = this.db.prepare(countSql);
      const result = stmt.get(countParams) as { count: number };

      return result?.count || 0;
    } catch (error) {
      Logger.error(`查询失败，表名: ${this.tableName}:`, {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * 检查记录是否存在
   * @param id - 记录 ID（UUID 字符串）
   * @returns 记录存在返回 true，否则返回 false
   */
  exists(id: string): boolean {
    try {
      if (!id || id.trim() === "") {
        return false;
      }

      const sql = `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE id = ?) AS exists_flag`;
      const stmt = this.db.prepare(sql);
      const result = stmt.get(id) as { exists_flag: number };

      return result?.exists_flag === 1;
    } catch (error) {
      Logger.error(`查询失败，表名: ${this.tableName}:`, {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * 在事务中执行回调函数
   * @param callback - 事务回调函数
   * @returns 回调函数的返回值
   */
  transaction<Result>(callback: () => Result): Result {
    try {
      Logger.debug(`开始事务: ${this.tableName}`);
      const result = this.db.transaction(callback)();
      Logger.debug(`事务完成，表名: ${this.tableName}`);
      return result;
    } catch (error) {
      Logger.error(`事务失败，表名: ${this.tableName}:`, {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * 分页查询记录
   * @param params - 查询参数对象，支持通用分页参数和条件参数
   * @param params.page - 页码（从 1 开始），默认 1
   * @param params.pageSize - 每页记录数（最大 100），默认 50
   * @param params.orderBy - 排序字段，默认为 'created_at'
   * @param params.orderDir - 排序方向，默认为 'ASC'
   * @param params.conditions - 查询条件对象（由子类实现）
   * @returns 分页结果对象，包含数据、总数、页码和分页信息
   */
  paginate(
    params: {
      page?: number;
      pageSize?: number;
      orderBy?: string;
      orderDir?: "ASC" | "DESC";
      conditions?: Record<string, unknown>;
    } = {},
  ): PaginationResult<T> {
    try {
      const page = Math.max(1, params.page || 1);
      const pageSize = Math.min(Math.max(1, params.pageSize || 50), 100);
      const orderBy = params.orderBy || "created_at";
      const orderDir = params.orderDir || "ASC";

      const offset = (page - 1) * pageSize;
      const safeOrderBy = this.sanitizeOrderBy(orderBy);
      const safeOrderDir = orderDir.toUpperCase() === "DESC" ? "DESC" : "ASC";

      let sql = `SELECT * FROM ${this.tableName}`;
      const values: unknown[] = [];

      if (params.conditions && Object.keys(params.conditions).length > 0) {
        const whereClause = this.buildWhereClause(params.conditions);
        sql += ` WHERE ${whereClause.sql}`;
        values.push(...whereClause.values);
      }

      sql += ` ORDER BY ${safeOrderBy} ${safeOrderDir} LIMIT ? OFFSET ?`;
      values.push(pageSize, offset);

      Logger.debug(`分页查询: ${sql}`, { params, page, pageSize, offset });

      const stmt = this.db.prepare(sql);
      const data = stmt.all(...values) as T[];

      const total = this.countWithConditions(params.conditions);

      const totalPages = Math.ceil(total / pageSize);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;
      const startIndex = (page - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, total);

      Logger.debug(`分页查询完成`, {
        table: this.tableName,
        dataCount: data.length,
        total,
        page,
        pageSize,
        totalPages,
      });

      return {
        data,
        total,
        page,
        pageSize,
        totalPages,
        hasNext,
        hasPrev,
        startIndex,
        endIndex,
      };
    } catch (error) {
      Logger.error(`分页查询失败，表名: ${this.tableName}:`, {
        error: String(error),
        params,
      });
      throw error;
    }
  }

  /**
   * 构建 WHERE 子句（由子类实现具体逻辑）
   * @param conditions - 查询条件对象
   * @param tablePrefix - 可选的表别名前缀（如 'p'），避免联表查询时列名歧义
   * @returns 包含 SQL 和参数的 WHERE 子句对象
   */
  protected buildWhereClause(
    conditions: Record<string, unknown>,
    tablePrefix?: string,
  ): {
    sql: string;
    values: unknown[];
  } {
    const conditionsArray: string[] = [];
    const values: unknown[] = [];
    const prefix = tablePrefix ? `${tablePrefix}.` : "";

    for (const [key, value] of Object.entries(conditions)) {
      if (value !== undefined && value !== null) {
        if (typeof value === "string" && value.includes("%")) {
          conditionsArray.push(`${prefix}${key} LIKE ?`);
          values.push(value);
        } else {
          conditionsArray.push(`${prefix}${key} = ?`);
          values.push(value);
        }
      }
    }

    const sql =
      conditionsArray.length > 0 ? conditionsArray.join(" AND ") : "1=1";
    return { sql, values };
  }

  /**
   * 根据条件统计记录数量
   * @param conditions - 查询条件对象
   * @returns 符合条件的记录总数
   */
  protected countWithConditions(conditions?: Record<string, unknown>): number {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const values: unknown[] = [];

    if (conditions && Object.keys(conditions).length > 0) {
      const whereClause = this.buildWhereClause(conditions);
      sql += ` WHERE ${whereClause.sql}`;
      values.push(...whereClause.values);
    }

    const result = this.query(sql, values);
    return result.length > 0 ? (result[0] as { count: number }).count : 0;
  }

  /**
   * 清理排序字段名称，防止 SQL 注入
   * @param orderBy - 待清理的排序字段
   * @returns 清理后的安全字段名
   */
  protected sanitizeOrderBy(orderBy: string): string {
    const safeColumn = orderBy.replace(/[^a-zA-Z0-9_]/g, "");
    if (!safeColumn) {
      return "id";
    }
    return safeColumn;
  }

  /**
   * 构建 LIKE 子串匹配模式（转义 %/_/\），配合 SQL `LIKE ? ESCAPE '\'` 使用。
   * 用于两类场景：关键词不足 3 个字符（trigram 分词器无法命中）时的回退，
   * 以及本身没有 FTS 索引的列。
   * @param keyword - 用户输入的关键词
   * @returns 形如 %keyword% 的匹配模式
   */
  protected buildLikePattern(keyword: string): string {
    const escaped = keyword.replace(/[\\%_]/g, (ch) => `\\${ch}`);
    return `%${escaped}%`;
  }

  /**
   * FTS5 trigram 分词器可命中的最短子串长度（按字符计）。
   * trigram 只索引「每 3 个字符」构成的三元组，少于 3 个字符的关键词无法命中，
   * 调用方需要回退到 LIKE 子串匹配。
   */
  protected static readonly FTS_MIN_CHARS = 3;

  /** {@link withFtsDeferred} 的作用域嵌套深度（>0 表示当前处于批量写入中） */
  private ftsDeferredDepth = 0;

  /**
   * 本表 FTS5 全文索引包含的列。
   * 无 FTS 索引的表返回空数组，写操作不会触发索引重建；
   * 有 FTS 索引的子类应覆写此 getter，声明参与索引的列。
   */
  protected get ftsIndexedFields(): readonly string[] {
    return [];
  }

  /**
   * 将关键词转换为 FTS5 短语查询串（trigram 分词器下等价于子串匹配）。
   * 关键词不足 {@link BaseDao.FTS_MIN_CHARS} 个字符时返回 null，调用方应回退 LIKE。
   * 内部双引号按 FTS5 语法双写转义，避免特殊字符破坏查询解析。
   * @param keyword - 用户输入的关键词
   * @returns 可直接绑定到 `MATCH ?` 的查询串；需回退 LIKE 时为 null
   */
  protected buildFtsPhrase(keyword: string): string | null {
    if ([...keyword].length < BaseDao.FTS_MIN_CHARS) {
      return null;
    }
    return `"${keyword.replace(/"/g, '""')}"`;
  }

  /**
   * 重建本表对应的 FTS5 全文索引（表名约定为 `<tableName>_fts`）。
   *
   * FTS5 表是 external-content（`content='<tableName>'`），索引不会随主表自动同步，
   * 主表变更后必须显式重建。统一使用 `'rebuild'`：它幂等、自愈——即使索引此前
   * 已与主表脱节，也不会像逐行 `'delete'` 那样损坏索引。
   */
  protected rebuildFts(): void {
    const ftsTable = `${this.tableName}_fts`;
    this.execute(`INSERT INTO ${ftsTable}(${ftsTable}) VALUES('rebuild')`);
  }

  /**
   * 主表写入后按需重建 FTS 索引。
   * - 表未声明 {@link ftsIndexedFields}（无 FTS 索引）时什么都不做；
   * - 处于 {@link withFtsDeferred} 作用域内时什么都不做，由最外层统一重建；
   * - 传入 data（更新场景）时，仅当数据涉及索引列才重建，避免 status / relevance
   *   等非索引列的更新也触发全量重建。
   * @param data - 本次写入的数据对象（创建/删除场景可省略）
   */
  protected refreshFts(data?: object): void {
    if (this.ftsDeferredDepth > 0) {
      return;
    }
    if (this.ftsIndexedFields.length === 0) {
      return;
    }
    if (
      data &&
      !this.ftsIndexedFields.some(
        (field) => (data as Record<string, unknown>)[field] !== undefined,
      )
    ) {
      return;
    }
    this.rebuildFts();
  }

  /**
   * 批量写入作用域：抑制作用域内每次 create/update/delete 的逐行索引重建，
   * 退出最外层时统一重建一次。
   *
   * `'rebuild'` 是**全表**重建，而 FTS 索引表是全库共享的：一次 N 行的批量写入
   * 若不做延迟，代价是 N+1 次全库重建（典型场景是语义块按文件整体替换）。
   * 计数器用**深度**而不是布尔，是为了让嵌套批量（全库重建时按文件循环）
   * 只在最外层收尾一次。
   *
   * 回调必须同步执行：延迟期间任何读到本表的调用方都会看到旧索引。
   * @param fn - 批量写入回调
   * @returns fn 的返回值
   */
  protected withFtsDeferred<T>(fn: () => T): T {
    this.ftsDeferredDepth += 1;
    try {
      return fn();
    } finally {
      this.ftsDeferredDepth -= 1;
      // 异常路径下的重建会被外层事务回滚带走，无需额外判别
      if (this.ftsDeferredDepth === 0 && this.ftsIndexedFields.length > 0) {
        this.rebuildFts();
      }
    }
  }

  /**
   * 执行原生 SQL 查询并返回原始结果
   * @param sql - SQL 查询语句
   * @param params - SQL 参数数组
   * @returns 原始查询结果
   */
  raw(sql: string, params?: unknown[]): unknown {
    try {
      Logger.debug(`查询: ${sql}`, { params: params?.length || 0 });
      const result = this.db.prepare(sql);
      return params ? result.all(params) : result.all();
    } catch (error) {
      Logger.error(`查询失败，表名: ${this.tableName}:`, {
        error: String(error),
      });
      throw error;
    }
  }
}
