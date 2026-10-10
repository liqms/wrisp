import { Logger } from "@/main/utils/logger";
import { getDatabase, getDbPath } from "@/main/core/db/connection";
import { MigrationDbDao } from "@/main/core/db/migrationDb.dao";
import { conceptDao } from "@/main/core/db/concept.dao";
import { normalizeConceptTitle } from "@/shared/utils";
import { MigrationDb } from "@/main/types/db";
import fs from "fs";
import { join } from "path";
import { compareVersions, VersionComparison } from "@/main/utils/version";
import { MIGRATIONS_DIR, SCHEMAS_DIR } from "@/main/constants";

interface MigrationFile {
  version: string;
  name: string;
  filePath: string;
  sqlContent: string;
}

export class DatabaseMigration {
  private static instance: DatabaseMigration | null = null;
  private migrationDbDao: MigrationDbDao;

  private constructor() {
    this.migrationDbDao = new MigrationDbDao();
  }

  public static getInstance(): DatabaseMigration {
    if (!DatabaseMigration.instance) {
      DatabaseMigration.instance = new DatabaseMigration();
    }
    return DatabaseMigration.instance;
  }

  /**
   * 获取数据库初始化脚本 (init.sql) 的完整文件路径。
   * schemas 目录随构建输出到 dist-electron/schemas（打包后位于
   * app.asar/dist-electron/schemas），因此始终相对 __dirname 解析。
   * @returns init.sql 文件的绝对路径
   */
  private getSchemaFilePath(): string {
    return join(__dirname, SCHEMAS_DIR, "init.sql");
  }

  /**
   * 获取迁移文件目录的完整路径。
   * @returns migrations 目录的绝对路径
   */
  private getMigrationsDir(): string {
    return join(__dirname, SCHEMAS_DIR, MIGRATIONS_DIR);
  }

  /**
   * 解析迁移文件名，提取版本号与迁移名称。
   * 文件名格式: {version}_{name}.sql，例如 1.1.1_add_blocks_is_memo.sql。
   * @param fileName - 迁移文件名
   * @returns 版本号与名称对象，解析失败返回 null
   */
  private parseMigrationFileName(
    fileName: string,
  ): { version: string; name: string } | null {
    const pattern = /^(\d+\.\d+\.\d+)_(.+)\.sql$/;
    const match = fileName.match(pattern);

    if (!match) {
      return null;
    }

    return {
      version: match[1],
      name: match[2].replace(/_/g, " "),
    };
  }

  /**
   * 从 migrations 目录加载所有迁移文件。
   * 读取目录下所有 .sql 文件，解析文件名获取版本号和名称，按版本号排序后返回。
   * @returns 迁移文件列表（按版本号升序排列）
   */
  private loadMigrationFiles(): MigrationFile[] {
    const migrationsDir = this.getMigrationsDir();
    const migrationFiles: MigrationFile[] = [];

    if (!fs.existsSync(migrationsDir)) {
      Logger.debug("迁移文件目录不存在", { migrationsDir });
      return migrationFiles;
    }

    try {
      const files = fs.readdirSync(migrationsDir);

      for (const file of files) {
        if (!file.endsWith(".sql")) {
          continue;
        }

        const parsed = this.parseMigrationFileName(file);
        if (!parsed) {
          Logger.warn("跳过无效的迁移文件名", { file });
          continue;
        }

        const filePath = join(migrationsDir, file);
        const sqlContent = fs.readFileSync(filePath, "utf-8");

        migrationFiles.push({
          version: parsed.version,
          name: parsed.name,
          filePath,
          sqlContent,
        });
      }

      migrationFiles.sort((a, b) => compareVersions(a.version, b.version));
      Logger.debug("加载迁移文件", { count: migrationFiles.length });
    } catch (error) {
      Logger.error("加载迁移文件失败", { migrationsDir, error: String(error) });
    }

    return migrationFiles;
  }

  /**
   * 初始化数据库表结构。
   * 读取 init.sql 脚本并执行，创建所有基础表和索引。
   * @returns 初始化成功返回 true
   * @throws 初始化失败时抛出错误
   */
  public initDatabaseSchema(): boolean {
    try {
      Logger.info("开始初始化数据库表结构");

      const db = getDatabase();
      const schemaPath = this.getSchemaFilePath();

      if (!fs.existsSync(schemaPath)) {
        Logger.error("数据库初始化脚本不存在:", {
          dbPath: getDbPath(),
          schemaPath,
        });
        throw new Error(`数据库初始化脚本不存在: ${schemaPath}`);
      }

      const sqlContent = fs.readFileSync(schemaPath, "utf-8");

      db.exec(sqlContent);

      Logger.info("数据库表结构初始化成功");
      return true;
    } catch (error) {
      Logger.error("数据库表结构初始化失败:", {
        dbPath: getDbPath(),
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * 确保 projects 表存在 is_pinned 字段（幂等）。
   * 旧版数据库没有该字段，且 init.sql 的 CREATE TABLE IF NOT EXISTS 不会为
   * 已存在的表补齐新列，因此在每次迁移完成后调用此方法补齐 schema。
   */
  public ensureProjectPinnedColumn(): void {
    try {
      const db = getDatabase();
      const columns = db
        .prepare("PRAGMA table_info(projects)")
        .all() as { name: string }[];

      if (columns.some((col) => col.name === "is_pinned")) {
        return;
      }

      db.exec("ALTER TABLE projects ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0");
      Logger.info("已为 projects 表新增 is_pinned 字段");
    } catch (error) {
      Logger.error("为 projects 表新增 is_pinned 字段失败:", {
        dbPath: getDbPath(),
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * 确保 pages 表存在 page_type 字段（幂等）。
   * 旧版数据库没有该字段（init.sql 的 CREATE TABLE IF NOT EXISTS 不会为
   * 已存在的表补齐新列），因此在每次迁移完成后调用此方法补齐 schema。
   */
  public ensurePageTypeColumn(): void {
    try {
      const db = getDatabase();
      const columns = db
        .prepare("PRAGMA table_info(pages)")
        .all() as { name: string }[];

      if (columns.some((col) => col.name === "page_type")) {
        return;
      }

      db.exec(
        "ALTER TABLE pages ADD COLUMN page_type TEXT NOT NULL DEFAULT 'project_chapter'",
      );
      Logger.info("已为 pages 表新增 page_type 字段");
    } catch (error) {
      Logger.error("为 pages 表新增 page_type 字段失败:", {
        dbPath: getDbPath(),
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * 确保 semantic_chunks 表存在 last_vectorized_at 字段（幂等）。
   * 该字段是 chunk-vectorize 的专用「已向量化」标记：此前向量化任务误用
   * last_smart_processed_at（被 chunk-summary 等任务共用）判定是否已向量化，
   * 导致语义块向量化永远选出 0 条。旧库需补齐该列。
   */
  public ensureChunkVectorizedColumn(): void {
    try {
      const db = getDatabase();
      const columns = db
        .prepare("PRAGMA table_info(semantic_chunks)")
        .all() as { name: string }[];

      if (columns.some((col) => col.name === "last_vectorized_at")) {
        return;
      }

      db.exec("ALTER TABLE semantic_chunks ADD COLUMN last_vectorized_at TEXT");
      Logger.info("已为 semantic_chunks 表新增 last_vectorized_at 字段");
    } catch (error) {
      Logger.error("为 semantic_chunks 表新增 last_vectorized_at 字段失败:", {
        dbPath: getDbPath(),
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * 确保 semantic_chunks 表存在 last_summary_generated_at 字段，并把历史水位回填齐（幂等）。
   *
   * 该列是 chunk-summary 的专用增量标记。摘要任务此前拿「ai_summary 为空」当判据，
   * 加了「无正文可摘要的块直接跳过」之后就失效了：跳过的块永远不会有摘要，
   * 每一轮整理都会把它们重新选出来空跑一遍。
   *
   * 回填把**已有摘要**的块的标记设为自身的 `updated_at`（语义即「正文的这个版本已摘要」），
   * 否则老库升级后整库会被重新推理一次。摘要为空的块保持 NULL：它们本来就要重跑，
   * 正好借首轮把非正文块标出去。
   */
  public ensureChunkSummaryStageColumn(): void {
    try {
      const db = getDatabase();
      const columns = db
        .prepare("PRAGMA table_info(semantic_chunks)")
        .all() as { name: string }[];

      if (columns.some((col) => col.name === "last_summary_generated_at")) {
        return;
      }

      db.exec(
        "ALTER TABLE semantic_chunks ADD COLUMN last_summary_generated_at TEXT",
      );
      const backfilled = db
        .prepare(
          `UPDATE semantic_chunks
             SET last_summary_generated_at = updated_at
           WHERE ai_summary IS NOT NULL AND ai_summary != ''`,
        )
        .run();
      Logger.info("已为 semantic_chunks 表新增 last_summary_generated_at 字段", {
        backfilled: backfilled.changes,
      });
    } catch (error) {
      Logger.error(
        "为 semantic_chunks 表新增 last_summary_generated_at 字段失败:",
        {
          dbPath: getDbPath(),
          error: String(error),
        },
      );
      throw error;
    }
  }

  /**
   * 移除 pages 表的 is_container 字段（幂等）。
   * 该字段为 v1「容器页」设计遗留，现已无任何代码引用。
   * 由于字段被 CHECK 约束与 idx_pages_container 索引引用，无法直接 DROP COLUMN，
   * 需按新 schema 重建表并回填数据；外键开关须在事务外设置。
   */
  public dropPagesContainerColumn(): void {
    try {
      const db = getDatabase();
      const columns = db
        .prepare("PRAGMA table_info(pages)")
        .all() as { name: string }[];

      if (!columns.some((col) => col.name === "is_container")) {
        return;
      }

      Logger.info("移除 pages 表 is_container 字段（重建表）");

      // PRAGMA foreign_keys 在事务内是 no-op，必须在事务外关闭/恢复
      db.pragma("foreign_keys = OFF");
      try {
        db.transaction(() => {
          db.exec(`
            CREATE TABLE pages_migrate_new (
                id TEXT PRIMARY KEY,
                project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
                title TEXT NOT NULL,
                file_path TEXT NOT NULL,
                order_index INTEGER DEFAULT 0,
                parent_page_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
                word_count INTEGER DEFAULT 0,
                ai_summary TEXT,
                page_type TEXT NOT NULL DEFAULT 'project_chapter',
                metadata TEXT DEFAULT '{}',
                last_smart_processed_at TEXT,
                last_summary_generated_at TEXT,
                last_vectorized_at TEXT,
                status TEXT DEFAULT 'active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                CHECK (status IN ('active', 'deleted'))
            )
          `);
          db.exec(`
            INSERT INTO pages_migrate_new
              (id, project_id, title, file_path, order_index, parent_page_id,
               word_count, ai_summary, page_type, metadata,
               last_smart_processed_at, last_summary_generated_at, last_vectorized_at,
               status, created_at, updated_at)
            SELECT
              id, project_id, title, file_path, order_index, parent_page_id,
              word_count, ai_summary, page_type, metadata,
              last_smart_processed_at, last_summary_generated_at, last_vectorized_at,
              status, created_at, updated_at
            FROM pages
          `);
          db.exec("DROP TABLE pages");
          db.exec("ALTER TABLE pages_migrate_new RENAME TO pages");
          // 重建 pages 表全部索引（idx_pages_container 不再创建）
          db.exec("CREATE INDEX IF NOT EXISTS idx_pages_project ON pages(project_id)");
          db.exec("CREATE INDEX IF NOT EXISTS idx_pages_order ON pages(project_id, order_index)");
          db.exec("CREATE INDEX IF NOT EXISTS idx_pages_parent ON pages(parent_page_id)");
          db.exec("CREATE INDEX IF NOT EXISTS idx_pages_summary ON pages(ai_summary)");
        })();
      } finally {
        db.pragma("foreign_keys = ON");
      }

      Logger.info("pages 表 is_container 字段移除完成");
    } catch (error) {
      Logger.error("移除 pages 表 is_container 字段失败", {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * 修复 pages 表 status 为 NULL 的历史数据（幂等）。
   * 旧版 PageService.updatePage 将未传入的 status/metadata 无条件写入 NULL，
   * 导致编辑保存后页面状态丢失，此处统一修复为 'active'。
   */
  public repairPagesNullStatus(): void {
    try {
      const db = getDatabase();
      const result = db
        .prepare("UPDATE pages SET status = 'active' WHERE status IS NULL")
        .run();

      if (result.changes > 0) {
        Logger.info("已修复 pages 表 NULL 状态记录", { count: result.changes });
      }
    } catch (error) {
      Logger.error("修复 pages 表 NULL 状态失败", { error: String(error) });
      throw error;
    }
  }

  /**
   * 确保 pages 表存在页面级分阶段处理标记（幂等）。
   *
   * 这三个列是 page-summary / page-vectorize 两个页面级智能任务的增量选取依据
   * （镜像 semantic_chunks 的同名列）。旧库没有它们，且 init.sql 的
   * CREATE TABLE IF NOT EXISTS 不会为已存在的表补齐新列，故在迁移后统一补齐。
   *
   * 列保持全 NULL：首轮整理会对所有页面做一次全量摘要与向量化，之后靠标记收敛。
   */
  public ensurePageStageColumns(): void {
    try {
      const db = getDatabase();
      const columns = db
        .prepare("PRAGMA table_info(pages)")
        .all() as { name: string }[];

      const missing = [
        "last_smart_processed_at",
        "last_summary_generated_at",
        "last_vectorized_at",
      ].filter((name) => !columns.some((col) => col.name === name));

      if (missing.length === 0) {
        return;
      }

      for (const name of missing) {
        db.exec(`ALTER TABLE pages ADD COLUMN ${name} TEXT`);
      }
      Logger.info("已为 pages 表补齐页面级分阶段标记列", { added: missing });
    } catch (error) {
      Logger.error("为 pages 表补齐页面级分阶段标记列失败:", {
        dbPath: getDbPath(),
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * 概念历史脏数据重建（设计 D4，随 0.5.0 迁移一次性执行）。
   *
   * 旧抽取逻辑把模型输出按逗号切分后逐块 `create`，同义词、全半角、大小写、
   * 首尾标点差异都会各建一个概念。这里按 `normalizeConceptTitle(title)` 分组，
   * 每组保留 `created_at` 最早者为 canonical，其余的块关联迁过去后删除。
   *
   * 必须在 0.5.0 的 SQL（加列 + UNIQUE 索引）之后执行：索引在全 NULL 列上创建是安全的，
   * 而回填 title_key 时同键只会命中一条（分组键即唯一键），不会撞 UNIQUE。
   *
   * 连带影响：删除从属概念会经 `topic_concepts` 的 ON DELETE CASCADE 清掉主题关联，
   * 主题要等迭代 5 的重聚类恢复，因此迁移后首轮整理前主题视图可能偏薄。
   */
  public dedupeConcepts(): void {
    try {
      const db = getDatabase();

      type ConceptRow = {
        id: string;
        title: string;
        title_key: string | null;
        aliases: string;
        mention_count: number;
        created_at: string;
      };

      const rows = db
        .prepare(
          "SELECT id, title, title_key, aliases, mention_count, created_at FROM concepts",
        )
        .all() as ConceptRow[];

      const groups = new Map<string, ConceptRow[]>();
      for (const row of rows) {
        const key = normalizeConceptTitle(row.title);
        // 归一后为空（纯标点标题）无合并依据，留待用户改名，不参与去重
        if (!key) continue;
        const bucket = groups.get(key);
        if (bucket) bucket.push(row);
        else groups.set(key, [row]);
      }

      let mergedRows = 0;
      let touched = 0;
      const timestamp = new Date().toISOString();

      db.transaction(() => {
        for (const [key, bucket] of groups) {
          const canonical = [...bucket].sort(
            (a, b) =>
              a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
          )[0];
          const dependents = bucket.filter((row) => row.id !== canonical.id);

          const aliasByKey = new Map<string, string>();
          let mentionTotal = 0;
          for (const row of bucket) {
            mentionTotal += row.mention_count || 0;
            for (const alias of this.parseAliasList(row.aliases)) {
              const aliasKey = normalizeConceptTitle(alias);
              // 分组键即 canonical 标题的归一形态，命中说明别名就是标题本身
              if (!aliasKey || aliasKey === key) continue;
              if (!aliasByKey.has(aliasKey)) aliasByKey.set(aliasKey, alias);
            }
          }
          const aliasesJson = JSON.stringify([...aliasByKey.values()]);

          // 已合并过的分组不再回写，避免每次启动把 updated_at 全刷一遍
          if (
            dependents.length === 0 &&
            canonical.title_key === key &&
            canonical.mention_count === mentionTotal &&
            canonical.aliases === aliasesJson
          ) {
            continue;
          }

          if (dependents.length > 0) {
            const dependentIds = dependents.map((row) => row.id);
            const placeholders = dependentIds.map(() => "?").join(",");

            // 先迁关联再删从属行：块级证据必须挂在 canonical 上，否则时间线会丢证据
            db.prepare(
              `INSERT OR IGNORE INTO concept_chunks
                 (concept_id, chunk_id, relevance_score, created_at, updated_at)
               SELECT ?, chunk_id, relevance_score, ?, ? FROM concept_chunks
               WHERE concept_id IN (${placeholders})`,
            ).run([canonical.id, timestamp, timestamp, ...dependentIds]);
            db.prepare(`DELETE FROM concept_chunks WHERE concept_id IN (${placeholders})`).run(dependentIds);
            db.prepare(`DELETE FROM concepts WHERE id IN (${placeholders})`).run(dependentIds);
            mergedRows += dependents.length;
          }

          db.prepare(
            `UPDATE concepts
             SET title_key = ?, aliases = ?, mention_count = ?, updated_at = ?
             WHERE id = ?`,
          ).run([key, aliasesJson, mentionTotal, timestamp, canonical.id]);
          touched++;
        }
      })();

      // external-content FTS 靠 rowid 回查主表，删除/改写主表后必须显式重建
      if (touched > 0) {
        conceptDao.rebuildFtsIndex();
        Logger.info("概念去重完成", { merged: mergedRows, groups: touched });
      }
    } catch (error) {
      Logger.error("概念去重失败", { error: String(error) });
      throw error;
    }
  }

  /**
   * 清空概念的抽取标记，使下一轮整理对全部块重跑抽取（设计 D4）。
   *
   * 清的是概念专属列：0.5.0 之前概念任务写在三任务共用的 `last_smart_processed_at`
   * 上，语义互相覆盖，已不再作为选取依据。
   */
  public clearConceptStageMarks(): void {
    try {
      const db = getDatabase();
      const result = db
        .prepare("UPDATE semantic_chunks SET last_concept_extracted_at = NULL")
        .run();
      if (result.changes > 0) {
        Logger.info("已清空概念抽取标记，下一轮全量重抽", { count: result.changes });
      }
    } catch (error) {
      Logger.error("清空概念抽取标记失败", { error: String(error) });
      throw error;
    }
  }

  /**
   * 0.5.0 的数据重建步骤：仅在「本次启动跨越了 0.5.0」时执行。
   * dedupe 本身幂等，但清空标记每次启动都跑会让全量重抽反复发生。
   * @param versionBeforeMigration - 迁移前的库版本（未初始化时为 null）
   */
  public applyConceptDedupMigration(versionBeforeMigration: string | null): void {
    const target = "0.5.0";
    const before = versionBeforeMigration || "0.0.0";
    if (compareVersions(before, target) !== VersionComparison.OLDER) {
      return;
    }
    if (compareVersions(this.getDatabaseVersion() || "0.0.0", target) === VersionComparison.OLDER) {
      Logger.warn("概念去重迁移跳过：0.5.0 迁移未执行成功", { before, after: this.getDatabaseVersion() });
      return;
    }

    this.dedupeConcepts();
    this.clearConceptStageMarks();
  }

  /** 解析 concepts.aliases 列；脏数据（非数组 / 非法 JSON）按空处理 */
  private parseAliasList(raw: string | null): string[] {
    if (!raw) return [];
    try {
      const value: unknown = JSON.parse(raw);
      return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
    } catch {
      return [];
    }
  }

  /**
   * 检查数据库是否已完成初始化。
   * 通过查询 sqlite_master 中是否存在 migrations_db 表来判断。
   * @returns 已初始化返回 true，否则返回 false
   */
  public isDatabaseInitialized(): boolean {
    try {
      const db = getDatabase();

      const result = db
        .prepare(
          `
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='migrations_db'
      `,
        )
        .get();

      return result !== undefined;
    } catch (error) {
      Logger.error("检查数据库初始化状态失败:", {
        dbPath: getDbPath(),
        error: String(error),
      });
      return false;
    }
  }

  /**
   * 获取当前数据库版本号。
   * 从 migrations_db 表中读取最新版本号。
   * @returns 当前版本号，获取失败返回 null
   */
  public getDatabaseVersion(): string | null {
    try {
      return this.migrationDbDao.getCurrentVersion();
    } catch (error) {
      Logger.error("获取数据库版本失败:", {
        dbPath: getDbPath(),
        error: String(error),
      });
      return null;
    }
  }

  /**
   * 获取数据库迁移的目标版本号。
   * 取「当前已执行版本 + 迁移文件 + 待执行迁移记录」中的最高版本号。
   * 以当前数据库版本为下限：init.sql 写入的基线迁移（0.5.1）已记录为 executed，
   * 若只取「迁移文件 + 待执行迁移记录」，无迁移文件时目标版本会退化为 "0.0.0"，
   * 导致 currentVersion(0.5.1) > targetVersion(0.0.0) 误报"当前数据库版本高于目标版本"。
   * 数据库尚未初始化时（migrations_db 不存在）返回 "0.0.0"（无需迁移）。
   * 作为 executeDatabaseMigration 的目标版本，替代原先对 .env SQLITE_DB_VERSION 的依赖。
   * @returns 目标版本号
   */
  public getTargetVersion(): string {
    const migrationFiles = this.loadMigrationFiles();

    // 数据库尚未初始化（migrations_db 表不存在）时，查询当前版本必然失败，
    // 会抛出 "no such table: migrations_db" 并产生误导性错误日志。
    // 此时直接从迁移文件派生目标版本（无迁移文件时为 0.0.0），
    // executeDatabaseMigration 内部会先执行 initDatabaseSchema。
    let target = "0.0.0";
    if (this.isDatabaseInitialized()) {
      target = this.getDatabaseVersion() || "0.0.0";
    }

    for (const file of migrationFiles) {
      if (compareVersions(file.version, target) === VersionComparison.NEWER) {
        target = file.version;
      }
    }

    if (this.isDatabaseInitialized()) {
      const pendingMigrations = this.migrationDbDao.findPendingMigrations();

      for (const migration of pendingMigrations) {
        if (
          compareVersions(migration.version, target) ===
          VersionComparison.NEWER
        ) {
          target = migration.version;
        }
      }
    }

    return target;
  }

  /**
   * 执行数据库迁移，将数据库升级到目标版本。
   * 如果数据库尚未初始化，先执行 initDatabaseSchema；如果当前版本低于目标版本，
   * 按顺序执行所有未执行的迁移文件（优先从文件加载，否则从 migrations_db 表读取）。
   * @param targetVersion - 目标版本号，默认为 "1.0.0"
   * @returns 迁移成功返回 true，当前版本已为目标版本或高于目标版本返回 false
   * @throws 迁移失败时抛出错误
   */
  public executeDatabaseMigration(targetVersion: string = "1.0.0"): boolean {
    try {
      // 数据库尚未初始化（如首次运行/全新安装）时，migrations_db 表不存在，
      // 无法查询当前版本，直接执行初始化脚本。
      if (!this.isDatabaseInitialized()) {
        Logger.info("数据库尚未初始化，执行初始化");
        this.initDatabaseSchema();
        return true;
      }

      const currentVersion = this.getDatabaseVersion();

      if (!currentVersion) {
        Logger.info("数据库尚未初始化，执行初始化");
        this.initDatabaseSchema();
        return true;
      }

      if (
        compareVersions(currentVersion, targetVersion) ===
        VersionComparison.NEWER
      ) {
        Logger.warn("当前数据库版本高于目标版本", {
          currentVersion,
          targetVersion,
        });
        return false;
      }

      if (
        compareVersions(currentVersion, targetVersion) ===
        VersionComparison.EQUAL
      ) {
        Logger.info("数据库版本已为目标版本", { currentVersion });
        return false;
      }

      Logger.info("开始执行数据库迁移", { currentVersion, targetVersion });

      const migrationFiles = this.loadMigrationFiles();
      const pendingMigrations = this.migrationDbDao.findPendingMigrations();

      const migrationsToProcess =
        migrationFiles.length > 0
          ? this.buildMigrationsFromFiles(migrationFiles, pendingMigrations)
          : pendingMigrations.map((m) => ({
            id: m.id,
            version: m.version,
            sql_statement: m.sql_statement,
          }));

      for (const migration of migrationsToProcess) {
        if (
          compareVersions(migration.version, targetVersion) ===
          VersionComparison.NEWER
        ) {
          continue;
        }

        Logger.debug("执行数据库迁移", { version: migration.version });

        const db = getDatabase();
        const startTime = Date.now();

        try {
          db.exec(migration.sql_statement);
        } catch (error) {
          // SQLite 的 ALTER TABLE ADD COLUMN 无 IF NOT EXISTS。旧版 init.sql 把
          // 0.2.0~0.5.1 的列直接建在 schema 里却只登记 0.1.0 基线，导致下次启动
          // 重放这些迁移、撞上已存在的列而抛 "duplicate column name" 并中断启动。
          // 目标列已存在即说明该迁移已生效，补登记版本后继续（见 registerExecutedMigration）。
          if (this.isDuplicateColumnError(error)) {
            this.registerExecutedMigration(migration.version);
            Logger.warn("迁移目标列已存在，按已执行处理", {
              version: migration.version,
            });
            continue;
          }
          throw error;
        }

        const executionTime = Date.now() - startTime;

        const existingMigration = pendingMigrations.find(
          (pm) => pm.version === migration.version,
        );
        if (existingMigration) {
          this.migrationDbDao.markAsExecuted(
            existingMigration.id,
            executionTime,
          );
        }

        Logger.debug("数据库迁移完成", {
          version: migration.version,
          executionTime,
        });
      }

      Logger.info("数据库迁移完成", { currentVersion, targetVersion });
      return true;
    } catch (error) {
      Logger.error("数据库迁移失败:", {
        dbPath: getDbPath(),
        error: String(error),
      });
      throw error;
    }
  }

  /** 判断 SQLite 报错是否为「列已存在」（ALTER TABLE ADD COLUMN 无 IF NOT EXISTS） */
  private isDuplicateColumnError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /duplicate column name/i.test(message);
  }

  /**
   * 为「目标列已存在、SQL 中途报错」的迁移补登记 executed 记录。
   *
   * 迁移文件把自登记 INSERT 放在文件末尾，而 ALTER 在开头就抛错，导致该 INSERT
   * 从未执行，版本无法前进、每次启动都会重复走到这里。补一条记录让版本正常收敛。
   * @param version - 需要补登记的迁移版本号
   */
  private registerExecutedMigration(version: string): void {
    const now = new Date().toISOString();
    getDatabase()
      .prepare(
        `INSERT OR IGNORE INTO migrations_db
           (id, version, name, description, sql_statement, status, executed_at, execution_time, created_at, updated_at)
         VALUES (?, ?, ?, ?, '--', 'executed', ?, 0, ?, ?)`,
      )
      .run(
        `recovered-${version}`,
        version,
        `Recovered ${version}`,
        "迁移目标列已存在，补登记为已执行",
        now,
        now,
        now,
      );
  }

  /**
   * 从迁移文件构建待执行的迁移列表。
   * 过滤掉已执行的版本，只保留版本号大于当前数据库版本的迁移文件。
   * @param migrationFiles - 已加载的迁移文件列表
   * @param existingMigrations - 数据库中已有的迁移记录
   * @returns 待执行的迁移列表
   */
  private buildMigrationsFromFiles(
    migrationFiles: MigrationFile[],
    existingMigrations: MigrationDb[],
  ): { id: string; version: string; sql_statement: string }[] {
    const executedVersions = new Set(
      existingMigrations
        .filter((m) => m.status === "executed")
        .map((m) => m.version),
    );

    const result: { id: string; version: string; sql_statement: string }[] = [];

    for (const file of migrationFiles) {
      if (executedVersions.has(file.version)) {
        continue;
      }

      if (
        compareVersions(this.getDatabaseVersion() || "0.0.0", file.version) !==
        VersionComparison.OLDER
      ) {
        continue;
      }

      result.push({
        id: `file-${file.version}`,
        version: file.version,
        sql_statement: file.sqlContent,
      });
    }

    return result;
  }
}

export const databaseMigration = DatabaseMigration.getInstance();
