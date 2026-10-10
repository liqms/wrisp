// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { vi } from "vitest";
import { DatabaseSync } from "node:sqlite";

/**
 * 用 node:sqlite 跑真实 SQL：这里要钉住的是「补列 + 回填」这套行为本身
 * （幂等、只回填已有摘要的块），字符串级 mock 断言不了 ALTER / UPDATE 是否合法。
 * better-sqlite3 的原生插件按当前 ABI 编译，vitest 的 Node 环境加载不了，只需桩掉类型引用。
 */
vi.mock("better-sqlite3", () => ({ default: class DatabaseStub {} }));
vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

let db: DatabaseSync;
vi.mock("@/main/core/db/connection", () => ({
  getDatabase: () => db,
  getDbPath: () => ":memory:",
  isDatabaseConnected: () => db !== undefined,
  setWorkspacePath: vi.fn(),
}));

import { databaseMigration } from "@/main/core/migration/database.migration";

const SUMMARY_COL = "last_summary_generated_at";

function columns(): string[] {
  return (db.prepare("PRAGMA table_info(semantic_chunks)").all() as Array<{
    name: string;
  }>).map((col) => col.name);
}

function rows(): Array<{ id: string; ai_summary: string | null; marker: string | null }> {
  return db
    .prepare(`SELECT id, ai_summary, ${SUMMARY_COL} AS marker FROM semantic_chunks ORDER BY id`)
    .all() as Array<{ id: string; ai_summary: string | null; marker: string | null }>;
}

/** 模拟 0.5.x 老库：有 ai_summary，但还没有摘要阶段的专用标记列 */
function createLegacyTable(): void {
  db.exec(`
    CREATE TABLE semantic_chunks (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      ai_summary TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.prepare(
    "INSERT INTO semantic_chunks (id, content, ai_summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run("c1", "正文一", "已有摘要", "2026-01-01", "2026-01-05");
  db.prepare(
    "INSERT INTO semantic_chunks (id, content, ai_summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run("c2", "正文二", null, "2026-01-01", "2026-01-06");
  db.prepare(
    "INSERT INTO semantic_chunks (id, content, ai_summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  ).run("c3", "正文三", "", "2026-01-01", "2026-01-07");
}

/** 模拟新库：init.sql 已建好该列，补列逻辑必须整体跳过 */
function createCurrentTable(): void {
  db.exec(`
    CREATE TABLE semantic_chunks (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      ai_summary TEXT,
      ${SUMMARY_COL} TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.prepare(
    `INSERT INTO semantic_chunks (id, content, ai_summary, ${SUMMARY_COL}, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run("c1", "正文一", "已有摘要", "2026-02-02", "2026-01-01", "2026-01-05");
}

describe("semantic_chunks.last_summary_generated_at 补列与回填", () => {
  beforeEach(() => {
    db?.close();
    db = new DatabaseSync(":memory:");
  });

  it("老库补列后，把已有摘要的块回填为自身 updated_at", () => {
    createLegacyTable();

    databaseMigration.ensureChunkSummaryStageColumn();

    expect(columns()).toContain(SUMMARY_COL);
    expect(rows()).toEqual([
      // 老库升级不该重烧整库：有摘要 = 当前正文已摘要
      { id: "c1", ai_summary: "已有摘要", marker: "2026-01-05" },
      // 摘要为空的块保持 NULL：首轮重跑时顺便把非正文块标出去
      { id: "c2", ai_summary: null, marker: null },
      { id: "c3", ai_summary: "", marker: null },
    ]);
  });

  it("重复执行不再改列、也不覆盖已写好的标记", () => {
    createLegacyTable();
    databaseMigration.ensureChunkSummaryStageColumn();
    db.prepare(`UPDATE semantic_chunks SET ${SUMMARY_COL} = 'SENTINEL' WHERE id = 'c1'`).run();

    expect(() => databaseMigration.ensureChunkSummaryStageColumn()).not.toThrow();

    expect(columns().filter((name) => name === SUMMARY_COL)).toHaveLength(1);
    expect(rows()[0].marker).toBe("SENTINEL");
  });

  it("新库（init.sql 已含该列）直接跳过", () => {
    createCurrentTable();

    databaseMigration.ensureChunkSummaryStageColumn();

    expect(rows()[0].marker).toBe("2026-02-02");
  });
});
