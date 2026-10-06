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
  memDb.exec(fs.readFileSync(path.resolve(process.cwd(), "src/main/schemas/init.sql"), "utf-8"));
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
import { NodeCryptoUtil } from "@/main/utils/crypto";
import type { ChunkCreate } from "@/main/types/db";

const timestamp = "2026-01-01T00:00:00.000Z";

/** 一条切分结果（content_hash 与切分器同样由正文派生） */
function chunkOf(startLine: number, content: string, fileId = "file-1"): ChunkCreate {
  return {
    file_id: fileId,
    file_path: "/tmp/a.md",
    start_line: startLine,
    end_line: startLine,
    section_title: null,
    content,
    content_hash: NodeCryptoUtil.sha256(content),
    word_count: content.length,
    status: "active",
  };
}

function rowsOf(dao: ChunkDao): Array<{ id: string; start_line: number; content: string }> {
  return dao.query("SELECT id, start_line, content FROM semantic_chunks ORDER BY rowid") as Array<{
    id: string;
    start_line: number;
    content: string;
  }>;
}

describe("ChunkDao.syncByFile 按 content_hash 复用 id", () => {
  const dao = new ChunkDao();

  beforeEach(() => {
    const db = getDatabase();
    db.exec("DELETE FROM temporal_events");
    db.exec("DELETE FROM semantic_links");
    db.exec("DELETE FROM semantic_chunks");
    db.exec("DELETE FROM file_index");
    db.prepare(
      "INSERT INTO file_index (id, file_path, file_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run("file-1", "/tmp/a.md", "hash-1", timestamp, timestamp);
  });

  it("正文未变的块保留原 id、摘要与向量化标记", () => {
    const keepA = chunkOf(1, "第一段内容。");
    const keepB = chunkOf(2, "第二段内容。");
    dao.create(keepA);
    dao.create(keepB);
    const before = rowsOf(dao);
    getDatabase()
      .prepare("UPDATE semantic_chunks SET ai_summary = ?, last_vectorized_at = ? WHERE id = ?")
      .run("摘要A", timestamp, before[0].id);

    // 只有第二段改了正文
    const result = dao.syncByFile("file-1", [keepA, chunkOf(2, "第二段改写了。")]);

    expect(result).toMatchObject({ reused: 1, inserted: 1, total: 2 });
    expect(result.removedIds).toEqual([before[1].id]);

    const after = rowsOf(dao);
    expect(after.map((row) => row.id)).toContain(before[0].id);
    const kept = dao.findById(before[0].id)!;
    expect(kept.ai_summary).toBe("摘要A");
    expect(kept.last_vectorized_at).toBe(timestamp);
    // 正文变化的块是新行，旧 id 已释放
    expect(dao.findById(before[1].id)).toBeUndefined();
  });

  it("正文相同的重复块按出现顺序配对，id 不错配", () => {
    const duplicated = chunkOf(1, "重复的引用句。");
    dao.create({ ...duplicated, start_line: 1, end_line: 1 });
    dao.create({ ...duplicated, start_line: 9, end_line: 9 });
    const [firstId, secondId] = rowsOf(dao).map((row) => row.id);

    // 新结果里两句顺序颠倒：行区间必须跟随第一个位置，而不是随便配一个
    dao.syncByFile("file-1", [
      { ...duplicated, start_line: 20, end_line: 20 },
      { ...duplicated, start_line: 30, end_line: 30 },
    ]);

    expect(dao.findById(firstId)!.start_line).toBe(20);
    expect(dao.findById(secondId)!.start_line).toBe(30);
  });

  it("清理范围只含消失的块：关联行按块删除，保留块的关系不动", () => {
    const keep = chunkOf(1, "保留的块。");
    const gone = chunkOf(2, "将被删掉的块。");
    dao.create(keep);
    dao.create(gone);
    const [keepId, goneId] = rowsOf(dao).map((row) => row.id);
    const db = getDatabase();
    db.prepare(
      "INSERT INTO semantic_links (id, source_chunk_id, target_chunk_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run("link-1", keepId, goneId, timestamp, timestamp);
    db.prepare(
      "INSERT INTO temporal_events (id, chunk_id, event_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run("event-keep", keepId, "mention", timestamp, timestamp);
    db.prepare(
      "INSERT INTO temporal_events (id, chunk_id, event_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run("event-gone", goneId, "mention", timestamp, timestamp);

    const result = dao.syncByFile("file-1", [keep]);

    expect(result.removedIds).toEqual([goneId]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM semantic_links").get()).toEqual({ n: 0 });
    const events = db.prepare("SELECT id FROM temporal_events").all() as Array<{ id: string }>;
    expect(events).toEqual([{ id: "event-keep" }]);
    expect(dao.findById(keepId)).not.toBeNull();
  });

  it("边界移动时行区间跟随，正文不重写", () => {
    const moved = chunkOf(3, "同一句正文。");
    dao.create(chunkOf(1, "同一句正文。"));
    const id = rowsOf(dao)[0].id;

    dao.syncByFile("file-1", [moved]);

    const row = dao.findById(id)!;
    expect(row.start_line).toBe(3);
    expect(row.end_line).toBe(3);
    expect(row.content).toBe("同一句正文。");
  });

  it("软删除的块不被复活", () => {
    dao.create(chunkOf(1, "已软删的块。"));
    const id = rowsOf(dao)[0].id;
    dao.update(id, { status: "deleted" });

    const result = dao.syncByFile("file-1", [chunkOf(1, "已软删的块。")]);

    expect(result.reused).toBe(0);
    expect(result.removedIds).toEqual([]);
    expect(dao.findById(id)!.status).toBe("deleted");
    expect(rowsOf(dao)).toHaveLength(2);
  });

  it("延迟重建后全文索引仍能命中新正文", () => {
    dao.syncByFile("file-1", [chunkOf(1, "第一批内容用于全文检索校验。")]);
    dao.syncByFile("file-1", [
      chunkOf(1, "第一批内容用于全文检索校验。"),
      chunkOf(2, "改过之后的检索关键词。"),
    ]);

    const hits = dao.searchFts("检索关键词", 10);
    expect(hits).toHaveLength(1);
    expect(hits[0].content).toBe("改过之后的检索关键词。");

    dao.syncByFile("file-1", [chunkOf(1, "第一批内容用于全文检索校验。")]);
    expect(dao.searchFts("检索关键词", 10)).toHaveLength(0);
  });

  it("空 fileId 不写库", () => {
    expect(dao.syncByFile("", [chunkOf(1, "任何内容")])).toEqual({
      reused: 0,
      inserted: 0,
      removedIds: [],
      total: 1,
    });
    expect(rowsOf(dao)).toHaveLength(0);
  });
});

describe("ChunkDao 批量写入的 FTS 重建次数", () => {
  const dao = new ChunkDao();

  beforeEach(() => {
    const db = getDatabase();
    db.exec("DELETE FROM semantic_chunks");
    db.exec("DELETE FROM file_index");
    db.prepare(
      "INSERT INTO file_index (id, file_path, file_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run("file-1", "/tmp/a.md", "hash-1", timestamp, timestamp);
    db.prepare(
      "INSERT INTO file_index (id, file_path, file_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run("file-2", "/tmp/b.md", "hash-2", timestamp, timestamp);
  });

  it("一次 500 块的同步只重建 1 次全表索引", () => {
    const rebuild = vi
      .spyOn(dao as unknown as { rebuildFts: () => void }, "rebuildFts")
      .mockImplementation(() => {});

    const chunks = Array.from({ length: 500 }, (_, i) =>
      chunkOf(i + 1, `第${i + 1}块正文，用于长度装箱与索引重建计数。`),
    );
    dao.syncByFile("file-1", chunks);

    expect(rebuild).toHaveBeenCalledTimes(1);
    rebuild.mockRestore();
  });

  it("改一个字时写入量骤减，索引仍只重建 1 次", () => {
    const chunks = Array.from({ length: 200 }, (_, i) =>
      chunkOf(i + 1, `第${i + 1}块正文，用于长度装箱与索引重建计数。`),
    );
    dao.syncByFile("file-1", chunks);

    const rebuild = vi
      .spyOn(dao as unknown as { rebuildFts: () => void }, "rebuildFts")
      .mockImplementation(() => {});
    const tweaked = [...chunks];
    tweaked[100] = chunkOf(101, "第101块正文，改了一个字。");
    const result = dao.syncByFile("file-1", tweaked);

    expect(result.reused).toBe(199);
    expect(result.inserted).toBe(1);
    expect(rebuild).toHaveBeenCalledTimes(1);
    rebuild.mockRestore();
  });

  it("嵌套的批量作用域只在最外层重建一次", () => {
    const rebuild = vi
      .spyOn(dao as unknown as { rebuildFts: () => void }, "rebuildFts")
      .mockImplementation(() => {});

    const syncTwice = (): void => {
      dao.syncByFile("file-1", [chunkOf(1, "外层作用域内的第一文件。")]);
      dao.syncByFile("file-2", [chunkOf(1, "外层作用域内的第二文件。", "file-2")]);
    };
    (dao as unknown as { withFtsDeferred: <T>(fn: () => T) => T }).withFtsDeferred(syncTwice);

    expect(rebuild).toHaveBeenCalledTimes(1);
    rebuild.mockRestore();
  });
});
