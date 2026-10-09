// @vitest-environment node
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const MIGRATION_FILE = path.resolve(
  process.cwd(),
  "src/main/schemas/migrations/0.7.0_journal_entries.sql",
);
const INIT_FILE = path.resolve(process.cwd(), "src/main/schemas/init.sql");
const TS = "2026-01-01T00:00:00.000Z";

/** 复刻 0.7.0 之前的最小依赖集：migrations_db + file_index + semantic_chunks + tags + tagged_items + projects */
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
      VALUES ('baseline', '0.6.0', 'baseline', 'init', 'executed', '${TS}', '${TS}');
    CREATE TABLE file_index (
      id TEXT PRIMARY KEY, file_path TEXT NOT NULL UNIQUE, file_hash TEXT NOT NULL,
      file_size INTEGER DEFAULT 0, date TEXT, name TEXT, last_synced TEXT,
      sync_status TEXT DEFAULT 'pending', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE semantic_chunks (
      id TEXT PRIMARY KEY, file_id TEXT NOT NULL, file_path TEXT NOT NULL,
      start_line INTEGER NOT NULL, end_line INTEGER NOT NULL, content TEXT NOT NULL,
      chunk_type TEXT DEFAULT 'journal', ai_summary TEXT, status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE tags (
      id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT DEFAULT '',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE tagged_items (
      tag_id TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
      added_at TEXT NOT NULL, PRIMARY KEY (tag_id, entity_type, entity_id)
    );
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, file_path TEXT NOT NULL, description TEXT,
      type TEXT, status TEXT DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      ai_summary TEXT DEFAULT '', structure TEXT DEFAULT '', metadata TEXT DEFAULT '{}',
      is_pinned INTEGER NOT NULL DEFAULT 0, CHECK (status IN ('active', 'deleted'))
    );
  `);
  return db;
}

function createFreshDb(): Database.Database {
  const fresh = new Database(":memory:");
  fresh.exec(fs.readFileSync(INIT_FILE, "utf-8"));
  return fresh;
}

function tableNames(db: Database.Database): string[] {
  return (db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all() as Array<{ name: string }>).map((r) => r.name);
}

function columnNames(db: Database.Database, table: string): string[] {
  return (db
    .prepare(`PRAGMA table_info(${table})`)
    .all() as Array<{ name: string }>).map((c) => c.name);
}

function indexNames(db: Database.Database, table: string): string[] {
  return (db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ? ORDER BY name")
    .all(table) as Array<{ name: string }>).map((r) => r.name);
}

describe("0.7.0 journal_entries 迁移", () => {
  it("在存量库上建两张新表、补 entry_id 列并自登记 0.7.0", () => {
    const db = createLegacyDb();
    db.exec(fs.readFileSync(MIGRATION_FILE, "utf-8"));

    expect(tableNames(db)).toEqual(
      expect.arrayContaining(["journal_entries", "journal_entry_projects"]),
    );
    expect(columnNames(db, "semantic_chunks")).toContain("entry_id");

    const record = db
      .prepare("SELECT version, status FROM migrations_db WHERE version = '0.7.0'")
      .get() as { version: string; status: string } | undefined;
    expect(record?.status).toBe("executed");
    db.close();
  });

  it("ADD COLUMN 无 IF NOT EXISTS：靠自登记防重放，重复 exec 显式报错", () => {
    const db = createLegacyDb();
    const sql = fs.readFileSync(MIGRATION_FILE, "utf-8");
    db.exec(sql);

    // 钉住「迁移文件必须自登记」的原因：半途重跑不会被 SQLite 吸收
    expect(() => db.exec(sql)).toThrow(/duplicate column name/i);

    db.close();
  });

  it("新条目行可写入，关联表外键级联删除生效", () => {
    const db = createLegacyDb();
    db.exec(fs.readFileSync(MIGRATION_FILE, "utf-8"));
    db.prepare(
      `INSERT INTO journal_entries (id, date, occurred_at, source, type, content, created_at, updated_at)
       VALUES ('e1', '2026-10-09', '2026-10-09T01:00:00.000Z', 'desktop', 'text', '内容', ?, ?)`,
    ).run(TS, TS);
    db.prepare("INSERT INTO projects (id, name, file_path, created_at, updated_at) VALUES ('p1', '作品A', '/x', ?, ?)").run(TS, TS);
    db.prepare("INSERT INTO journal_entry_projects (entry_id, project_id, added_at) VALUES ('e1', 'p1', ?)").run(TS);
    expect((db.prepare("SELECT COUNT(*) n FROM journal_entry_projects").get() as { n: number }).n).toBe(1);
    db.prepare("DELETE FROM journal_entries WHERE id = 'e1'").run();
    expect((db.prepare("SELECT COUNT(*) n FROM journal_entry_projects").get() as { n: number }).n).toBe(0);
    db.close();
  });

  it("init.sql 全新库含同构表/列，基线版本为 0.7.0", () => {
    const fresh = createFreshDb();
    expect(tableNames(fresh)).toEqual(
      expect.arrayContaining(["journal_entries", "journal_entry_projects"]),
    );
    expect(columnNames(fresh, "semantic_chunks")).toContain("entry_id");
    const baseline = fresh
      .prepare("SELECT version FROM migrations_db ORDER BY version DESC LIMIT 1")
      .get() as { version: string };
    expect(baseline.version).toBe("0.7.0");
    fresh.close();
  });

  it("存量库升级后的表结构与全新库一致（索引不缺）", () => {
    const db = createLegacyDb();
    db.exec(fs.readFileSync(MIGRATION_FILE, "utf-8"));
    const fresh = createFreshDb();

    for (const table of ["journal_entries", "journal_entry_projects"]) {
      expect(columnNames(db, table)).toEqual(columnNames(fresh, table));
      expect(indexNames(db, table)).toEqual(indexNames(fresh, table));
    }
    // semantic_chunks 在两库中的既有索引不同（测试库只复刻依赖集），只比对本次新增的那条
    expect(indexNames(db, "semantic_chunks")).toContain("idx_semantic_chunks_entry");
    expect(indexNames(fresh, "semantic_chunks")).toContain("idx_semantic_chunks_entry");

    db.close();
    fresh.close();
  });

  it("CHECK 约束拒绝未知 source / type，合法枚举值可写入", () => {
    const db = createLegacyDb();
    db.exec(fs.readFileSync(MIGRATION_FILE, "utf-8"));
    const insert = db.prepare(
      `INSERT INTO journal_entries (id, date, occurred_at, source, type, content, created_at, updated_at)
       VALUES (?, '2026-10-09', '2026-10-09T01:00:00.000Z', ?, ?, '内容', ?, ?)`,
    );
    expect(() => insert.run("bad-src", "web", "text", TS, TS)).toThrow(/CHECK constraint/i);
    expect(() => insert.run("bad-type", "desktop", "note", TS, TS)).toThrow(/CHECK constraint/i);
    expect(() => insert.run("ok", "desktop", "voice", TS, TS)).not.toThrow();
    db.close();
  });
});
