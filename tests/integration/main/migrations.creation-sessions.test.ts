// @vitest-environment node
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const MIGRATION_FILE = path.resolve(
  process.cwd(),
  "src/main/schemas/migrations/0.3.0_add_creation_sessions_table.sql",
);

describe("0.3.0 creation_sessions 迁移文件", () => {
  /** 模拟老库：只有 migrations_db（0.1.0 基线已 executed），没有 creation_sessions */
  function createLegacyDb(): Database.Database {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE migrations_db (
          id TEXT PRIMARY KEY,
          version TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          sql_statement TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          executed_at TEXT DEFAULT '',
          execution_time INTEGER,
          checksum TEXT DEFAULT '',
          error_message TEXT DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
      );
    `);
    return db;
  }

  it("在存量库上创建 creation_sessions 表并自登记迁移记录", () => {
    const db = createLegacyDb();
    db.exec(fs.readFileSync(MIGRATION_FILE, "utf-8"));

    const table = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='creation_sessions'",
      )
      .get();
    expect(table).toBeTruthy();

    const record = db
      .prepare("SELECT status FROM migrations_db WHERE version = '0.3.0'")
      .get() as { status: string } | undefined;
    expect(record?.status).toBe("executed");

    db.close();
  });

  it("重复执行幂等：不报错也不重复登记", () => {
    const db = createLegacyDb();
    const sql = fs.readFileSync(MIGRATION_FILE, "utf-8");
    db.exec(sql);
    db.exec(sql);

    const count = db
      .prepare("SELECT COUNT(*) AS c FROM migrations_db WHERE version = '0.3.0'")
      .get() as { c: number };
    expect(count.c).toBe(1);

    db.close();
  });
});
