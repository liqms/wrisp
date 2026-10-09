// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
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
vi.mock("@/main/core/db/connection", () => ({ getDatabase: () => mem(), setWorkspacePath: vi.fn() }));
vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { ChunkDao } from "@/main/core/db/chunk.dao";
import { collectChunks, splitDocument } from "@/main/core/services/content/chunk-splitter";

const TS = "2026-10-09T01:00:00.000Z";

function seedFileAndEntry(db: Database.Database) {
  // 子表先删：semantic_chunks.file_id 以非级联外键引用 file_index，
  // 若先删 file_index 会触发 FOREIGN KEY constraint failed（用例间共享同一内存库）
  db.exec("DELETE FROM semantic_chunks; DELETE FROM file_index; DELETE FROM journal_entries;");
  db.prepare(
    "INSERT INTO file_index (id, file_path, file_hash, created_at, updated_at) VALUES ('f1', 'journal/2026-10-09.md', 'h', ?, ?)",
  ).run(TS, TS);
  db.prepare(
    `INSERT INTO journal_entries (id, date, occurred_at, source, type, content, created_at, updated_at)
     VALUES ('e1', '2026-10-09', ?, 'desktop', 'text', 'x', ?, ?)`,
  ).run(TS, TS, TS);
}

function makeRecord(content: string, hash: string, entryId = "e1") {
  return {
    file_id: "f1", file_path: "journal/2026-10-09.md",
    start_line: 1, end_line: 2, content, content_hash: hash,
    chunk_type: "journal" as const, entry_id: entryId, status: "active" as const,
  };
}

describe("ChunkDao.syncByEntry", () => {
  it("同 hash 复用 id（保留摘要/标记水位线），异 hash 删旧插新", () => {
    seedFileAndEntry(mem());
    const dao = new ChunkDao();
    const first = dao.syncByEntry("e1", [makeRecord("段落A", "hash-a"), makeRecord("段落B", "hash-b")]);
    expect(first.inserted).toBe(2);
    const keptA = dao.query("SELECT * FROM semantic_chunks ORDER BY start_line ASC") as Array<{ id: string; content_hash: string }>;
    // 重切：A 不变、B 改成 C
    const second = dao.syncByEntry("e1", [makeRecord("段落A", "hash-a"), makeRecord("段落C", "hash-c")]);
    expect(second.reused).toBe(1);
    expect(second.inserted).toBe(1);
    expect(second.removedIds).toHaveLength(1);
    const after = dao.query("SELECT content_hash FROM semantic_chunks") as Array<{ content_hash: string }>;
    expect(after.map((r) => r.content_hash).sort()).toEqual(["hash-a", "hash-c"]);
    const reusedRow = dao.findById(keptA[0].id);
    expect(reusedRow?.content_hash).toBe("hash-a"); // 未变块 id 与内容保留
  });

  it("entry 维度删除不越界影响其它 entry/文件的块", () => {
    seedFileAndEntry(mem());
    const dao = new ChunkDao();
    mem().prepare(
      `INSERT INTO journal_entries (id, date, occurred_at, source, type, content, created_at, updated_at)
       VALUES ('e2', '2026-10-09', ?, 'desktop', 'text', 'y', ?, ?)`,
    ).run(TS, TS, TS);
    dao.syncByEntry("e1", [makeRecord("段落A", "hash-a")]);
    dao.syncByEntry("e2", [makeRecord("段落E2", "hash-e2", "e2")]);
    dao.syncByEntry("e1", []);
    const rest = dao.query("SELECT entry_id FROM semantic_chunks") as Array<{ entry_id: string }>;
    expect(rest).toEqual([{ entry_id: "e2" }]);
  });

  // Step-4（条目1）headless 复核：真实切分器（L1+L2，零模型）把一条长多段条目切成多块，
  // 经 syncByEntry 落库后每块都带非空 entry_id——条目才是切块锚点，而非整篇文件。
  it("长多段条目 → 真实切分出多块，落库后每块 entry_id 非空", () => {
    seedFileAndEntry(mem());
    const dao = new ChunkDao();

    // 16 段各不相同的正文，总量远超 CHUNK_MAX_COARSE_CHARS(500)，触发 L2 长度切分
    const content = Array.from(
      { length: 16 },
      (_, i) =>
        `第${i}段：今天复盘了向量检索的召回率问题，发现分块粒度过粗会让短查询命中不到最相关的句子，需要评估更细的切分策略与重叠窗口。`,
    ).join("\n\n");
    expect(content.length).toBeGreaterThan(500);

    const chunks = collectChunks(splitDocument(content).segments);
    expect(chunks.length).toBeGreaterThanOrEqual(2);

    const records = chunks.map((chunk) => ({
      file_id: "f1",
      file_path: "journal/2026-10-09.md",
      start_line: chunk.startLine,
      end_line: chunk.endLine,
      section_title: chunk.sectionTitle,
      content: chunk.content,
      content_hash: chunk.contentHash,
      chunk_type: "journal" as const,
      entry_id: "e1",
      word_count: chunk.wordCount,
      status: "active" as const,
    }));
    dao.syncByEntry("e1", records);

    const rows = dao.query(
      "SELECT id, entry_id FROM semantic_chunks WHERE chunk_type = 'journal'",
    ) as Array<{ id: string; entry_id: string | null }>;
    expect(rows.length).toBe(chunks.length);
    expect(rows.every((r) => r.entry_id === "e1")).toBe(true);
  });
});
