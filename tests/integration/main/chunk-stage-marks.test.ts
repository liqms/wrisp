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

let memDb: Database.Database | null = null;
function initMemDb(): Database.Database {
  memDb = new Database(":memory:");
  memDb.pragma("journal_mode = WAL");
  memDb.pragma("foreign_keys = ON");
  const schemaPath = path.resolve(process.cwd(), "src/main/schemas/init.sql");
  memDb.exec(fs.readFileSync(schemaPath, "utf-8"));
  return memDb;
}
vi.mock("@/main/core/db/connection", () => ({
  getDatabase: () => {
    if (!memDb) initMemDb();
    return memDb!;
  },
  initDatabase: () => {
    if (!memDb) initMemDb();
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

import { ChunkDao } from "@/main/core/db/chunk.dao";
import { getDatabase } from "@/main/core/db/connection";

const TS = "2026-01-01T00:00:00.000Z";

/**
 * 与 concept-extract.executor 的选取条件同形。
 * 测试里重写一份而不是复用生产 SQL：这里要钉住的是「标记列 + updated_at」这套
 * 增量语义本身（收敛、正文变更后可重入、墓碑不参与），而不是某个字符串。
 */
const UNEXTRACTED_SQL = `
  SELECT id FROM semantic_chunks
  WHERE status = 'active'
    AND (last_concept_extracted_at IS NULL OR updated_at > last_concept_extracted_at)
  ORDER BY id
`;

/** 与 semantic-link.executor 的选取条件同形（上游门槛是摘要阶段的标记列，不是 ai_summary） */
const UNLINKED_SQL = `
  SELECT id FROM semantic_chunks
  WHERE status = 'active' AND last_summary_generated_at IS NOT NULL
    AND (last_linked_at IS NULL OR updated_at > last_linked_at)
  ORDER BY id
`;

/** 与 chunk-vectorize.executor 的选取条件同形 */
const UNVECTORIZED_SQL = `
  SELECT id FROM semantic_chunks
  WHERE last_summary_generated_at IS NOT NULL AND status = 'active'
    AND (last_vectorized_at IS NULL OR updated_at > last_vectorized_at)
  ORDER BY id
`;

function ids(sql: string): string[] {
  return (getDatabase().prepare(sql).all() as Array<{ id: string }>).map((row) => row.id);
}

describe("语义块分阶段标记列（迭代 6 / §3.7）", () => {
  let dao: ChunkDao;

  beforeEach(() => {
    const db = getDatabase();
    db.exec("DELETE FROM semantic_links");
    db.exec("DELETE FROM concept_chunks");
    db.exec("DELETE FROM concepts");
    db.exec("DELETE FROM semantic_chunks");
    db.exec("DELETE FROM file_index");
    db.prepare(
      "INSERT INTO file_index (id, file_path, file_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run("file-1", "/tmp/a.md", "hash-1", TS, TS);
    for (const [id, content, hash] of [
      ["chunk-1", "内容", "h1"],
      ["chunk-2", "内容2", "h2"],
    ]) {
      // last_summary_generated_at 一并给值：它是下游阶段的上游门槛（等价于「摘要阶段已跑完」）
      db.prepare(
        `INSERT INTO semantic_chunks (id, file_id, file_path, start_line, end_line, content, content_hash, ai_summary, last_summary_generated_at, created_at, updated_at)
         VALUES (?, 'file-1', '/tmp/a.md', 1, 2, ?, ?, '摘要', ?, ?, ?)`,
      ).run(id, content, hash, TS, TS, TS);
    }
    dao = new ChunkDao();
  });

  describe("recordStage", () => {
    it("写阶段标记，但不刷新 updated_at", () => {
      const before = dao.findById("chunk-1")!;
      expect(before.last_concept_extracted_at).toBeNull();

      expect(dao.recordStage("chunk-1", ["last_concept_extracted_at"])).toBe(1);

      const after = dao.findById("chunk-1")!;
      expect(after.last_concept_extracted_at).toBeTruthy();
      // 关键不变量：水位线不动，否则下一轮 updated_at > 标记 会把本块再选中一次
      expect(after.updated_at).toBe(before.updated_at);
    });

    it("顺带写时间热度分，仍然不动 updated_at", () => {
      const before = dao.findById("chunk-1")!;

      dao.recordStage("chunk-1", ["last_linked_at", "last_smart_processed_at"], 0.5);

      const after = dao.findById("chunk-1")!;
      expect(after.temporal_score).toBe(0.5);
      expect(after.last_linked_at).toBeTruthy();
      expect(after.last_smart_processed_at).toBeTruthy();
      expect(after.updated_at).toBe(before.updated_at);
    });

    it("空 id / 空列名单都不发 SQL", () => {
      expect(dao.recordStage("", ["last_linked_at"])).toBe(0);
      expect(dao.recordStage("chunk-1", [])).toBe(0);
      expect(dao.recordStageBatch([], ["last_linked_at"])).toBe(0);
    });

    it("recordStageBatch 一次给整批写标记", () => {
      expect(dao.recordStageBatch(["chunk-1", "chunk-2"], ["last_vectorized_at"])).toBe(2);

      for (const id of ["chunk-1", "chunk-2"]) {
        expect(dao.findById(id)!.last_vectorized_at).toBeTruthy();
      }
    });
  });

  describe("增量选取的收敛性", () => {
    it("新列全为 NULL 时整库待处理（0.5.1 上线后首轮即全量重抽）", () => {
      expect(ids(UNEXTRACTED_SQL)).toEqual(["chunk-1", "chunk-2"]);
    });

    it("写了标记就不再被选中，正文改动后又回到待处理队列", () => {
      dao.recordStage("chunk-1", ["last_concept_extracted_at"]);
      expect(ids(UNEXTRACTED_SQL)).toEqual(["chunk-2"]);

      // 用显式的更晚时间戳模拟「标记之后又编辑过正文」：真实链路上 update() 会
      // 刷新 updated_at，但同一毫秒内的 wall-clock 比较不稳定，不适合作断言依据
      getDatabase()
        .prepare("UPDATE semantic_chunks SET updated_at = ? WHERE id = 'chunk-1'")
        .run("2027-01-01T00:00:00.000Z");

      expect(ids(UNEXTRACTED_SQL)).toEqual(["chunk-1", "chunk-2"]);
    });

    it("三个阶段各自独立收敛，互不覆盖标记", () => {
      dao.recordStage("chunk-1", ["last_concept_extracted_at"]);

      // 概念跑过，链接/向量化仍认为 chunk-1 待处理
      expect(ids(UNEXTRACTED_SQL)).toEqual(["chunk-2"]);
      expect(ids(UNLINKED_SQL)).toContain("chunk-1");
      expect(ids(UNVECTORIZED_SQL)).toContain("chunk-1");

      dao.recordStage("chunk-1", ["last_linked_at"], 0.4);
      dao.recordStage("chunk-1", ["last_vectorized_at"]);

      expect(ids(UNLINKED_SQL)).toEqual(["chunk-2"]);
      expect(ids(UNVECTORIZED_SQL)).toEqual(["chunk-2"]);
      // 概念标记没被链接阶段冲掉
      expect(dao.findById("chunk-1")!.last_concept_extracted_at).toBeTruthy();
    });

    it("软删除的墓碑块不进任何阶段的选取", () => {
      getDatabase()
        .prepare("UPDATE semantic_chunks SET status = 'deleted' WHERE id = 'chunk-2'")
        .run();

      expect(ids(UNEXTRACTED_SQL)).toEqual(["chunk-1"]);
      expect(ids(UNLINKED_SQL)).toEqual(["chunk-1"]);
      expect(ids(UNVECTORIZED_SQL)).toEqual(["chunk-1"]);
    });
  });

  describe("syncByFile 不污染水位线", () => {
    it("正文未变的块只跟边界，不刷新 updated_at，因而不会被重抽", () => {
      dao.recordStage("chunk-1", ["last_concept_extracted_at"]);
      const beforeUpdatedAt = dao.findById("chunk-1")!.updated_at;

      dao.syncByFile("file-1", [
        {
          file_id: "file-1",
          file_path: "/tmp/a.md",
          start_line: 40,
          end_line: 60,
          content: "内容",
          content_hash: "h1",
          word_count: 2,
        },
        {
          file_id: "file-1",
          file_path: "/tmp/a.md",
          start_line: 61,
          end_line: 80,
          content: "内容2",
          content_hash: "h2",
          word_count: 2,
        },
      ]);

      const after = dao.findById("chunk-1")!;
      expect(after.start_line).toBe(40);
      expect(after.updated_at).toBe(beforeUpdatedAt);
      expect(ids(UNEXTRACTED_SQL)).toEqual(["chunk-2"]);
    });

    it("正文变化的块以新行入库，阶段标记为空 → 下一轮重跑", () => {
      dao.recordStage("chunk-1", ["last_concept_extracted_at"]);

      dao.syncByFile("file-1", [
        {
          file_id: "file-1",
          file_path: "/tmp/a.md",
          start_line: 1,
          end_line: 2,
          content: "改过的正文",
          content_hash: "h1-new",
          word_count: 3,
        },
        {
          file_id: "file-1",
          file_path: "/tmp/a.md",
          start_line: 3,
          end_line: 4,
          content: "内容2",
          content_hash: "h2",
        },
      ]);

      const pending = ids(UNEXTRACTED_SQL);
      expect(pending).toContain("chunk-2");
      expect(pending).not.toContain("chunk-1");
      // 旧行已被硬删除，新行补位：总数仍是 2
      const rows = getDatabase()
        .prepare("SELECT COUNT(*) AS c FROM semantic_chunks")
        .get() as { c: number };
      expect(rows.c).toBe(2);
      expect(pending).toHaveLength(2);
    });
  });
});
