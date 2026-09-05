// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/tmp"),
    getVersion: vi.fn(() => "1.0.0"),
    getName: vi.fn(() => "Wrisp"),
    on: vi.fn(),
  },
  BrowserWindow: vi.fn(),
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() },
}));
vi.mock("@/main/utils/logger", () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}));

const MIGRATION_FILE = path.resolve(
  process.cwd(),
  "src/main/schemas/migrations/0.2.0_add_characters_table.sql",
);

describe("0.2.0 characters 迁移文件", () => {
  /** 模拟老库：仅有 migrations_db（0.1.0 基线）与 projects 表 */
  function createLegacyDb(): Database.Database {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
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
          updated_at TEXT NOT NULL,
          CHECK (status IN ('pending', 'executed', 'failed'))
      );
      INSERT INTO migrations_db (id, version, name, description, sql_statement, status, executed_at, created_at, updated_at)
      VALUES ('00000000-0000-0000-0000-000000000001', '0.1.0', 'Init', '', '--', 'executed', '2026-06-28T00:00:00.000Z', '2026-06-28T00:00:00.000Z', '2026-06-28T00:00:00.000Z');

      CREATE TABLE projects (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          file_path TEXT NOT NULL,
          status TEXT DEFAULT 'active',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
      );
    `);
    return db;
  }

  beforeEach(() => {
    expect(fs.existsSync(MIGRATION_FILE)).toBe(true);
  });

  it("老库执行迁移后：characters 表创建、唯一索引生效", () => {
    const db = createLegacyDb();
    db.exec(fs.readFileSync(MIGRATION_FILE, "utf-8"));

    const cols = db.prepare("PRAGMA table_info(characters)").all() as {
      name: string;
    }[];
    expect(cols.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        "id",
        "name",
        "owner_type",
        "owner_id",
        "description",
        "metadata",
        "created_at",
        "updated_at",
      ]),
    );

    // 表达式唯一索引：同名联系人重复插入被拒
    db.prepare(
      "INSERT INTO characters (id, name, owner_type, owner_id, created_at, updated_at) VALUES ('c1', '张三', 'contact', NULL, '2026-09-05T00:00:00.000Z', '2026-09-05T00:00:00.000Z')",
    ).run();
    expect(() =>
      db
        .prepare(
          "INSERT INTO characters (id, name, owner_type, owner_id, created_at, updated_at) VALUES ('c2', '张三', 'contact', NULL, '2026-09-05T00:00:00.000Z', '2026-09-05T00:00:00.000Z')",
        )
        .run(),
    ).toThrow();
    db.close();
  });

  it("迁移自登记 migrations_db（0.2.0 executed），重复执行幂等", () => {
    const db = createLegacyDb();
    const sql = fs.readFileSync(MIGRATION_FILE, "utf-8");

    db.exec(sql);
    const record = db
      .prepare("SELECT * FROM migrations_db WHERE version = '0.2.0'")
      .get() as { status: string };
    expect(record.status).toBe("executed");

    // 重复执行不报错（IF NOT EXISTS + INSERT OR IGNORE）
    expect(() => db.exec(sql)).not.toThrow();
    const count = (
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM migrations_db WHERE version = '0.2.0'",
        )
        .get() as { n: number }
    ).n;
    expect(count).toBe(1);
    db.close();
  });
});
