// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let memDb: Database.Database | null = null;
function mem() {
  if (!memDb) {
    memDb = new Database(":memory:");
    memDb.pragma("foreign_keys = ON");
    memDb.exec(fs.readFileSync(path.resolve(process.cwd(), "src/main/schemas/init.sql"), "utf-8"));
  }
  return memDb;
}
vi.mock("@/main/core/db/connection", () => ({
  getDatabase: () => mem(),
  setWorkspacePath: vi.fn(),
}));
vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { JournalEntryDao } from "@/main/core/db/journalEntry.dao";

const TS = "2026-10-09T01:00:00.000Z";
const D = "2026-10-09";

function seed(db: Database.Database, sql: string, ...p: unknown[]) { db.prepare(sql).run(...p); }

describe("JournalEntryDao", () => {
  let dao: JournalEntryDao;
  beforeEach(() => {
    // BaseDao 用 Date.now() 打 created_at/updated_at 水印；脏判定依赖 updated_at
    // 与固定 chunked_at 字面量（01:30）的先后关系，必须钉死时钟才可复现。
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T01:00:00.000Z"));
    dao = new JournalEntryDao();
    // projects 与 tags 都会被多个用例按固定 id 重复 seed，须一并清空避免跨用例 PRIMARY KEY 冲突
    mem().exec("DELETE FROM journal_entries; DELETE FROM journal_entry_projects; DELETE FROM tagged_items; DELETE FROM tags; DELETE FROM projects;");
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("create 生成 id 并按日期读取；软删行不出现在 listActiveByDate", () => {
    const id = dao.create({ date: D, occurred_at: TS, content: "早间记录" });
    expect(dao.listActiveByDate(D).map((r) => r.id)).toContain(id);
    dao.softDelete(id, "2026-10-09T02:00:00.000Z");
    expect(dao.listActiveByDate(D).map((r) => r.id)).not.toContain(id);
    expect(dao.listAllByDate(D).find((r) => r.id === id)?.deleted_at).toBe("2026-10-09T02:00:00.000Z");
  });

  it("脏判定：chunked_at 为空或 updated_at 更新过才算脏；recordChunked 不刷 updated_at", () => {
    const id = dao.create({ date: D, occurred_at: TS, content: "a" });
    expect(dao.listDirtyByDate(D).map((r) => r.id)).toContain(id);
    dao.recordChunked(id, "2026-10-09T01:30:00.000Z");
    const row = dao.findById(id)!;
    expect(row.chunked_at).toBe("2026-10-09T01:30:00.000Z");
    expect(row.updated_at).toBe(row.created_at); // 关键：水位线未动
    expect(dao.listDirtyByDate(D)).toHaveLength(0);
    vi.setSystemTime(new Date("2026-10-09T02:00:00.000Z")); // 编辑发生在切块之后
    dao.update(id, { content: "b" }); // update 刷 updated_at → 重新变脏
    expect(dao.listDirtyByDate(D).map((r) => r.id)).toContain(id);
  });

  it("replaceAssociations 先删后建、幂等", () => {
    const id = dao.create({ date: D, occurred_at: TS, content: "#标签 x" });
    seed(mem(), "INSERT INTO tags (id, name, created_at, updated_at) VALUES ('t1', '标签', ?, ?)", TS, TS);
    seed(mem(), "INSERT INTO projects (id, name, file_path, created_at, updated_at) VALUES ('p1', '作品A', '/x', ?, ?)", TS, TS);
    dao.replaceAssociations(id, ["t1"], ["p1"], TS);
    dao.replaceAssociations(id, ["t1"], ["p1"], TS);
    expect((mem().prepare("SELECT COUNT(*) n FROM tagged_items WHERE entity_type='journal_entry'").get() as { n: number }).n).toBe(1);
    expect((mem().prepare("SELECT COUNT(*) n FROM journal_entry_projects").get() as { n: number }).n).toBe(1);
    dao.replaceAssociations(id, [], [], TS);
    expect((mem().prepare("SELECT COUNT(*) n FROM tagged_items").get() as { n: number }).n).toBe(0);
  });

  it("assembleViews 返回按 (occurred_at,id) 排序的条目并带 tags/projects 名称", () => {
    const a = dao.create({ date: D, occurred_at: "2026-10-09T01:00:00.000Z", content: "x &作品A" });
    const b = dao.create({ date: D, occurred_at: "2026-10-09T02:00:00.000Z", content: "y #标签" });
    seed(mem(), "INSERT INTO tags (id, name, created_at, updated_at) VALUES ('t1', '标签', ?, ?)", TS, TS);
    seed(mem(), "INSERT INTO projects (id, name, file_path, created_at, updated_at) VALUES ('p1', '作品A', '/x', ?, ?)", TS, TS);
    dao.replaceAssociations(a, [], ["p1"], TS);
    dao.replaceAssociations(b, ["t1"], [], TS);
    const days = dao.assembleViews([D]);
    expect(days).toHaveLength(1);
    expect(days[0].entries.map((e) => e.id)).toEqual([a, b]);
    expect(days[0].entries[0].projects).toEqual([{ id: "p1", name: "作品A" }]);
    expect(days[0].entries[1].tags).toEqual([{ id: "t1", name: "标签" }]);
    expect(days[0].has_legacy_file).toBe(false);
  });

  it("listLegacyDates：有 journal 文件索引但当日无条目的日期入选", () => {
    seed(mem(), "INSERT INTO file_index (id, file_path, file_hash, date, created_at, updated_at) VALUES ('f1', 'journal/2026-10-08.md', 'h', '2026-10-08', ?, ?)", TS, TS);
    const id = dao.create({ date: "2026-10-07", occurred_at: "2026-10-07T01:00:00.000Z", content: "z" });
    expect(dao.listLegacyDates(30)).toEqual(["2026-10-08"]);
    seed(mem(), "INSERT INTO file_index (id, file_path, file_hash, date, created_at, updated_at) VALUES ('f2', 'journal/2026-10-07.md', 'h', '2026-10-07', ?, ?)", TS, TS);
    dao.softDelete(id, TS);
    expect(dao.listLegacyDates(30)).toContain("2026-10-07");
  });

  it("selectLegacyDatesWithin：按请求日期集合精确筛（无 1000 日窗口截断）", () => {
    seed(mem(), "INSERT INTO file_index (id, file_path, file_hash, date, created_at, updated_at) VALUES ('l1', 'journal/2019-01-01.md', 'h', '2019-01-01', ?, ?)", TS, TS);
    seed(mem(), "INSERT INTO file_index (id, file_path, file_hash, date, created_at, updated_at) VALUES ('l2', 'journal/2019-01-02.md', 'h', '2019-01-02', ?, ?)", TS, TS);
    seed(mem(), "INSERT INTO file_index (id, file_path, file_hash, date, created_at, updated_at) VALUES ('l3', 'pages/2019-01-03.md', 'h', '2019-01-03', ?, ?)", TS, TS);
    expect([...dao.selectLegacyDatesWithin(["2019-01-01", "2019-01-03", "2019-01-04"])]).toEqual(["2019-01-01"]);
    // 集合外的待导入日（l2）不得被带出；当日有活跃条目的日期也不得入选
    const id = dao.create({ date: "2019-01-05", occurred_at: "2019-01-05T01:00:00.000Z", content: "w" });
    seed(mem(), "INSERT INTO file_index (id, file_path, file_hash, date, created_at, updated_at) VALUES ('l4', 'journal/2019-01-05.md', 'h', '2019-01-05', ?, ?)", TS, TS);
    expect(dao.selectLegacyDatesWithin(["2019-01-05"])).toEqual(new Set());
    dao.softDelete(id, TS);
    expect(dao.selectLegacyDatesWithin(["2019-01-05"])).toEqual(new Set(["2019-01-05"]));
  });

  it("selectLegacyDatesWithin 空集合早退：返回空集且不发起查询", () => {
    const spy = vi.spyOn(
      dao as unknown as { query: (sql: string, params?: unknown[]) => unknown[] },
      "query",
    );
    expect(dao.selectLegacyDatesWithin([])).toEqual(new Set());
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("assembleViews 的 has_legacy_file 不受「最新 1000 个待导入日」窗口截断", () => {
    const db = mem();
    // 1001 个比目标日更新的待导入日：旧实现 listLegacyDates(1000) 只取最新 1000 个，
    // 目标日 2020-01-01 落在窗口外 ⇒ has_legacy_file=false ⇒「导入此文件」入口永久消失
    for (let i = 0; i < 1001; i++) {
      const date = new Date(Date.UTC(2021, 0, 1) + i * 86400000).toISOString().slice(0, 10);
      seed(
        db,
        "INSERT INTO file_index (id, file_path, file_hash, date, created_at, updated_at) VALUES (?, ?, 'h', ?, ?, ?)",
        `bulk-${i}`, `journal/${date}.md`, date, TS, TS,
      );
    }
    seed(db, "INSERT INTO file_index (id, file_path, file_hash, date, created_at, updated_at) VALUES ('old', 'journal/2020-01-01.md', 'h', '2020-01-01', ?, ?)", TS, TS);

    const days = dao.assembleViews(["2020-01-01"]);
    expect(days).toHaveLength(1);
    expect(days[0].has_legacy_file).toBe(true);
  });
});
