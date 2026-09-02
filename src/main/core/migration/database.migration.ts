import { Logger } from "@/main/utils/logger";
import { getDatabase, getDbPath } from "@/main/core/db/connection";
import { MigrationDbDao } from "@/main/core/db/migrationDb.dao";
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
                status TEXT DEFAULT 'active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                CHECK (status IN ('active', 'deleted'))
            )
          `);
          db.exec(`
            INSERT INTO pages_migrate_new
              (id, project_id, title, file_path, order_index, parent_page_id,
               word_count, ai_summary, page_type, metadata, status, created_at, updated_at)
            SELECT
              id, project_id, title, file_path, order_index, parent_page_id,
              word_count, ai_summary, page_type, metadata, status, created_at, updated_at
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
   * 以当前数据库版本为下限：init.sql 写入的基线迁移（0.1.0）已记录为 executed，
   * 若只取「迁移文件 + 待执行迁移记录」，无迁移文件时目标版本会退化为 "0.0.0"，
   * 导致 currentVersion(0.1.0) > targetVersion(0.0.0) 误报"当前数据库版本高于目标版本"。
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

        db.exec(migration.sql_statement);

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
