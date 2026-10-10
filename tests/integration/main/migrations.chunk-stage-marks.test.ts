// @vitest-environment node
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const MIGRATION_FILE = path.resolve(
  process.cwd(),
  "src/main/schemas/migrations/0.5.1_chunk_stage_marks.sql",
);
const TS = "2026-01-01T00:00:00.000Z";

/** 复刻 0.5.1 之前的 semantic_chunks 形态：只有三任务共用的 last_smart_processed_at */
function createLegacyDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE migrations_db (
      id TEXT PRIMARY KEY, version TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      description TEXT DEFAULT '', sql_statement TEXT NOT NULL, status TEXT DEFAULT 'pending',
      executed_at TEXT DEFAULT '', execution_time INTEGER, checksum TEXT DEFAULT '',
      error_message TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    INSERT INTO migrations_db (id, version, name, sql_statement, status, created_at, updated_at)
      VALUES ('baseline', '0.5.0', 'baseline', 'init', 'executed', '${TS}', '${TS}');

    CREATE TABLE file_index (
      id TEXT PRIMARY KEY, file_path TEXT NOT NULL, file_hash TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE semantic_chunks (
      id TEXT PRIMARY KEY, file_id TEXT NOT NULL, file_path TEXT NOT NULL, start_line INTEGER, end_line INTEGER,
      content TEXT NOT NULL, ai_summary TEXT, temporal_score REAL DEFAULT 0.0,
      last_smart_processed_at TEXT, last_vectorized_at TEXT, status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `);
  db.prepare(
    "INSERT INTO file_index (id, file_path, file_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run("file-1", "/tmp/a.md", "hash-1", TS, TS);
  db.prepare(
    `INSERT INTO semantic_chunks (id, file_id, file_path, start_line, end_line, content, last_smart_processed_at, created_at, updated_at)
     VALUES ('chunk-1', 'file-1', '/tmp/a.md', 1, 2, '内容', ?, ?, ?)`,
  ).run("2026-02-02T00:00:00.000Z", TS, TS);
  return db;
}

function columns(db: Database.Database): string[] {
  return (db.prepare("PRAGMA table_info(semantic_chunks)").all() as Array<{ name: string }>).map(
    (col) => col.name,
  );
}

describe("0.5.1 分阶段标记列迁移", () => {
  it("在存量库上补两列，自登记 0.5.1，并保持既有行的标记为空", () => {
    const db = createLegacyDb();
    db.exec(fs.readFileSync(MIGRATION_FILE, "utf-8"));

    expect(columns(db)).toEqual(
      expect.arrayContaining(["last_concept_extracted_at", "last_linked_at"]),
    );

    const record = db
      .prepare("SELECT version, status FROM migrations_db WHERE version = '0.5.1'")
      .get() as { version: string; status: string } | undefined;
    expect(record?.status).toBe("executed");

    // 新列为空 = 整库待重跑一次（概念去重后的全量重抽靠的就是这个初始态）
    const row = db
      .prepare(
        "SELECT last_concept_extracted_at AS c, last_linked_at AS l, last_smart_processed_at AS s FROM semantic_chunks",
      )
      .get() as { c: string | null; l: string | null; s: string | null };
    expect(row).toEqual({ c: null, l: null, s: "2026-02-02T00:00:00.000Z" });

    db.close();
  });

  it("ADD COLUMN 无 IF NOT EXISTS：靠自登记防止重复执行，重复 exec 会显式报错", () => {
    const db = createLegacyDb();
    const sql = fs.readFileSync(MIGRATION_FILE, "utf-8");
    db.exec(sql);

    // 这条断言钉住「迁移文件必须自登记」的原因：半途重跑不会被 SQLite 吸收
    expect(() => db.exec(sql)).toThrow(/duplicate column name/i);

    db.close();
  });

  it("init.sql 与迁移文件给出的列一致（全新库不需要跑迁移）", () => {
    const fresh = new Database(":memory:");
    fresh.exec(
      fs.readFileSync(
        path.resolve(process.cwd(), "src/main/schemas/init.sql"),
        "utf-8",
      ),
    );

    expect(columns(fresh)).toEqual(
      expect.arrayContaining([
        "last_smart_processed_at",
        "last_vectorized_at",
        "last_concept_extracted_at",
        "last_linked_at",
      ]),
    );

    fresh.close();
  });
});
