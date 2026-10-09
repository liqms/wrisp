// @vitest-environment node
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const MIGRATION_FILE = path.resolve(
  process.cwd(),
  "src/main/schemas/migrations/0.6.0_page_stage_marks.sql",
);
const TS = "2026-01-01T00:00:00.000Z";

const STAGE_COLUMNS = [
  "last_smart_processed_at",
  "last_summary_generated_at",
  "last_vectorized_at",
];

/** 复刻 0.6.0 之前的 pages 形态：只有业务列，没有任何页面级水位线 */
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
      VALUES ('baseline', '0.5.1', 'baseline', 'init', 'executed', '${TS}', '${TS}');

    CREATE TABLE pages (
      id TEXT PRIMARY KEY, project_id TEXT, title TEXT NOT NULL, file_path TEXT NOT NULL,
      order_index INTEGER DEFAULT 0, parent_page_id TEXT, word_count INTEGER DEFAULT 0,
      ai_summary TEXT, page_type TEXT NOT NULL DEFAULT 'project_chapter',
      metadata TEXT DEFAULT '{}', status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `);
  db.prepare(
    `INSERT INTO pages (id, project_id, title, file_path, order_index, ai_summary, status, created_at, updated_at)
     VALUES ('page-1', 'proj-1', '第一章', '/tmp/p.md', 0, '旧摘要', 'active', ?, ?)`,
  ).run(TS, TS);
  return db;
}

function columns(db: Database.Database): string[] {
  return (db.prepare("PRAGMA table_info(pages)").all() as Array<{ name: string }>).map(
    (col) => col.name,
  );
}

describe("0.6.0 页面级分阶段标记列迁移", () => {
  it("在存量库上补三列，自登记 0.6.0，并保持既有行的标记为空", () => {
    const db = createLegacyDb();
    db.exec(fs.readFileSync(MIGRATION_FILE, "utf-8"));

    expect(columns(db)).toEqual(expect.arrayContaining(STAGE_COLUMNS));

    const record = db
      .prepare("SELECT version, status FROM migrations_db WHERE version = '0.6.0'")
      .get() as { version: string; status: string } | undefined;
    expect(record?.status).toBe("executed");

    // 新列为空 = 整库待处理一次（页面级语义化的首轮全量重跑靠的就是这个初始态）
    const row = db
      .prepare(
        `SELECT last_smart_processed_at AS s, last_summary_generated_at AS g,
                last_vectorized_at AS v, ai_summary AS a FROM pages WHERE id = 'page-1'`,
      )
      .get() as {
      s: string | null;
      g: string | null;
      v: string | null;
      a: string | null;
    };
    expect(row).toEqual({ s: null, g: null, v: null, a: "旧摘要" });

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

    expect(columns(fresh)).toEqual(expect.arrayContaining(STAGE_COLUMNS));

    // 基线版本必须等于迁移文件最高版本，否则全新库下次启动会重放迁移并崩溃
    const baseline = fresh
      .prepare("SELECT version FROM migrations_db ORDER BY version DESC LIMIT 1")
      .get() as { version: string };
    expect(baseline.version).toBe("0.7.0");

    fresh.close();
  });
});
