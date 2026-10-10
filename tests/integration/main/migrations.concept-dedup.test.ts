// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => "/tmp"), getVersion: vi.fn(() => "1.0.0"), getName: vi.fn(() => "Wrisp"), on: vi.fn() },
  BrowserWindow: vi.fn(),
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() },
}));
vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() },
}));
vi.mock("winston", () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  format: { combine: vi.fn(), timestamp: vi.fn(), printf: vi.fn(), colorize: vi.fn(), simple: vi.fn(), json: vi.fn() },
  transports: { Console: vi.fn(), File: vi.fn() },
  addColors: vi.fn(),
}));
vi.mock("winston-daily-rotate-file", () => ({ default: vi.fn() }));

const MIGRATION_FILE = path.resolve(
  process.cwd(),
  "src/main/schemas/migrations/0.5.0_concept_dedup_and_evolution.sql",
);
// 0.5.1 把概念阶段标记拆成独立列，clearConceptStageMarks 写的是新列
const STAGE_MARK_MIGRATION_FILE = path.resolve(
  process.cwd(),
  "src/main/schemas/migrations/0.5.1_chunk_stage_marks.sql",
);
const TS = "2026-01-01T00:00:00.000Z";

/** 复刻 0.5.0 之前的 concepts 形态：没有 title_key / aliases / mention_count / last_evolved_at */
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
      VALUES ('baseline', '0.1.0', 'baseline', 'init', 'executed', '${TS}', '${TS}');

    CREATE TABLE file_index (
      id TEXT PRIMARY KEY, file_path TEXT NOT NULL, file_hash TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE semantic_chunks (
      id TEXT PRIMARY KEY, file_id TEXT NOT NULL, file_path TEXT NOT NULL, start_line INTEGER, end_line INTEGER,
      content TEXT NOT NULL, ai_summary TEXT, last_smart_processed_at TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE concepts (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, evolving_summary TEXT, timeline TEXT DEFAULT '[]',
      relevance REAL DEFAULT 0.0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE concepts_fts USING fts5(
      title, evolving_summary, content='concepts', content_rowid='rowid', tokenize='trigram'
    );
    CREATE TABLE concept_chunks (
      concept_id TEXT NOT NULL, chunk_id TEXT NOT NULL, relevance_score REAL DEFAULT 0.0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY (concept_id, chunk_id),
      FOREIGN KEY (concept_id) REFERENCES concepts(id) ON DELETE CASCADE,
      FOREIGN KEY (chunk_id) REFERENCES semantic_chunks(id) ON DELETE CASCADE
    );
    CREATE TABLE topics (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, summary TEXT, status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE topic_concepts (
      topic_id TEXT NOT NULL, concept_id TEXT NOT NULL, relevance_score REAL DEFAULT 0.0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY (topic_id, concept_id),
      FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
      FOREIGN KEY (concept_id) REFERENCES concepts(id) ON DELETE CASCADE
    );
  `);
  db.prepare(
    "INSERT INTO file_index (id, file_path, file_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run("file-1", "/tmp/a.md", "hash-1", TS, TS);
  db.prepare(
    "INSERT INTO semantic_chunks (id, file_id, file_path, start_line, end_line, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run("chunk-1", "file-1", "/tmp/a.md", 1, 2, "检索增强生成的讨论", TS, TS);

  // 脏数据：同义概念各建一行，且都还没有 title_key 可依据
  const rows: [string, string, string][] = [
    ["c-1", "RAG", "2026-01-02T00:00:00.000Z"],
    ["c-2", "rag。", "2026-01-03T00:00:00.000Z"],
    ["c-3", "向量数据库", "2026-01-04T00:00:00.000Z"],
  ];
  for (const [id, title, at] of rows) {
    db.prepare("INSERT INTO concepts (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)").run(id, title, at, at);
  }
  db.prepare(
    "INSERT INTO concept_chunks (concept_id, chunk_id, relevance_score, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run("c-2", "chunk-1", 0.8, TS, TS);
  db.prepare("INSERT INTO topics (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)").run("t-1", "主题", TS, TS);
  db.prepare(
    "INSERT INTO topic_concepts (topic_id, concept_id, created_at, updated_at) VALUES (?, ?, ?, ?)",
  ).run("t-1", "c-2", TS, TS);
  db.prepare("INSERT INTO concepts_fts(concepts_fts) VALUES('rebuild')").run();
  return db;
}

let memDb: Database.Database | null = null;
vi.mock("@/main/core/db/connection", () => ({
  getDatabase: () => {
    if (!memDb) memDb = createLegacyDb();
    return memDb!;
  },
  initDatabase: () => {
    if (!memDb) memDb = createLegacyDb();
    return memDb!;
  },
  closeDatabase: () => {
    memDb?.close();
    memDb = null;
  },
  setWorkspacePath: vi.fn(),
  getDbPath: () => ":memory:",
  isDatabaseConnected: () => memDb !== null,
}));

import { databaseMigration } from "@/main/core/migration/database.migration";
import { getDatabase } from "@/main/core/db/connection";

function columns(table: string): string[] {
  return (getDatabase().prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
    (c) => c.name,
  );
}

describe("0.5.0 概念去重迁移文件（存量库路径）", () => {
  beforeEach(() => {
    memDb = createLegacyDb();
  });

  it("加列并把 0.5.0 登记进 migrations_db", () => {
    getDatabase().exec(fs.readFileSync(MIGRATION_FILE, "utf-8"));

    expect(columns("concepts")).toEqual(
      expect.arrayContaining(["title_key", "aliases", "mention_count", "last_evolved_at"]),
    );
    const record = getDatabase()
      .prepare("SELECT status FROM migrations_db WHERE version = '0.5.0'")
      .get() as { status: string } | undefined;
    expect(record?.status).toBe("executed");
  });

  it("历史重复标题不阻塞 UNIQUE 索引创建（新列全为 NULL，NULL 之间不冲突）", () => {
    expect(() => getDatabase().exec(fs.readFileSync(MIGRATION_FILE, "utf-8"))).not.toThrow();

    const index = getDatabase()
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_concepts_title_key'")
      .get();
    expect(index).toBeTruthy();
  });

  it("加列后 dedupeConcepts 在存量库上完成合并并回填键", () => {
    getDatabase().exec(fs.readFileSync(MIGRATION_FILE, "utf-8"));
    databaseMigration.dedupeConcepts();

    const survivors = getDatabase()
      .prepare("SELECT id, title, title_key FROM concepts ORDER BY created_at")
      .all() as { id: string; title: string; title_key: string }[];
    expect(survivors.map((row) => row.id)).toEqual(["c-1", "c-3"]);
    expect(survivors.map((row) => row.title_key)).toEqual(["rag", "向量数据库"]);

    // 从属概念的块关联迁到 canonical，主题关联按 CASCADE 清理
    const links = getDatabase().prepare("SELECT concept_id, chunk_id FROM concept_chunks").all() as {
      concept_id: string;
      chunk_id: string;
    }[];
    expect(links).toEqual([{ concept_id: "c-1", chunk_id: "chunk-1" }]);
    expect(getDatabase().prepare("SELECT COUNT(*) AS c FROM topic_concepts").get()).toMatchObject({ c: 0 });
  });

  it("未跨过 0.5.0 的启动不再执行数据步骤（避免每轮全量重抽）", () => {
    const db = getDatabase();
    db.exec(fs.readFileSync(MIGRATION_FILE, "utf-8"));
    db.exec(fs.readFileSync(STAGE_MARK_MIGRATION_FILE, "utf-8"));
    db.prepare("UPDATE semantic_chunks SET last_concept_extracted_at = ?").run(TS);

    // 迁移前已是 0.5.0：本次启动不该再清标记
    databaseMigration.applyConceptDedupMigration("0.5.0");
    expect(db.prepare("SELECT last_concept_extracted_at AS at FROM semantic_chunks").get()).toMatchObject({
      at: TS,
    });

    // 迁移前是 0.4.1 且现已升到 0.5.0：数据步骤执行，标记被清空
    databaseMigration.applyConceptDedupMigration("0.4.1");
    expect(db.prepare("SELECT last_concept_extracted_at AS at FROM semantic_chunks").get()).toMatchObject({
      at: null,
    });
  });
});
