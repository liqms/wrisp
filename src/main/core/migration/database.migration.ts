import { Logger } from "@/main/utils/logger";
import { getDatabase, getDbPath } from "@/main/core/db/connection";
import { MigrationDbDao } from "@/main/core/db/migrationDb.dao";
import { MigrationDb } from "@/main/types/db";
import fs from "fs";
import { join, basename } from "path";
import { compareVersions, VersionComparison } from "@/main/utils/version";

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

  private getSchemaFilePath(): string {
    const isProduction = process.env.NODE_ENV === "production";
    let basePath = __dirname;

    if (isProduction) {
      basePath = join(basePath, "..", "schemas");
    } else {
      basePath = join(basePath, "schemas");
    }

    return join(basePath, "init.sql");
  }

  private getMigrationsDir(): string {
    const isProduction = process.env.NODE_ENV === "production";
    let basePath = __dirname;

    if (isProduction) {
      basePath = join(basePath, "..", "schemas", "migrations");
    } else {
      basePath = join(basePath, "schemas", "migrations");
    }

    return basePath;
  }

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

  public executeDatabaseMigration(targetVersion: string = "1.0.0"): boolean {
    try {
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

        try {
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
        } catch (error) {
          throw error;
        }
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
