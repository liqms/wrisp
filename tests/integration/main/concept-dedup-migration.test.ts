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

import { conceptDao } from "@/main/core/db/concept.dao";
import { conceptChunkDao } from "@/main/core/db/conceptChunk.dao";
import { databaseMigration } from "@/main/core/migration/database.migration";
import { getDatabase } from "@/main/core/db/connection";

type Row = Record<string, unknown>;

const TS = "2026-01-01T00:00:00.000Z";

function insertConcept(id: string, title: string, createdAt = TS, mentionCount = 0): void {
  getDatabase()
    .prepare(
      "INSERT INTO concepts (id, title, created_at, updated_at, mention_count) VALUES (?, ?, ?, ?, ?)",
    )
    .run(id, title, createdAt, createdAt, mentionCount);
}

function link(conceptId: string, chunkId: string, score: number): void {
  getDatabase()
    .prepare(
      "INSERT INTO concept_chunks (concept_id, chunk_id, relevance_score, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(conceptId, chunkId, score, TS, TS);
}

function concepts(): Row[] {
  return getDatabase().prepare("SELECT * FROM concepts ORDER BY created_at, id").all() as Row[];
}

describe("概念幂等落库与历史去重", () => {
  beforeEach(() => {
    const db = getDatabase();
    db.exec("DELETE FROM topic_concepts");
    db.exec("DELETE FROM topics");
    db.exec("DELETE FROM concept_chunks");
    db.exec("DELETE FROM concepts");
    db.exec("DELETE FROM semantic_chunks");
    db.exec("DELETE FROM file_index");
    db.prepare(
      "INSERT INTO file_index (id, file_path, file_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run("file-1", "/tmp/a.md", "hash-1", TS, TS);
    for (const id of ["chunk-1", "chunk-2"]) {
      db.prepare(
        "INSERT INTO semantic_chunks (id, file_id, file_path, start_line, end_line, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(id, "file-1", "/tmp/a.md", 1, 2, "内容", TS, TS);
    }
  });

  describe("upsertByTitleKey", () => {
    it("首次写入建行，再次写入同键合并而非新建", () => {
      const first = conceptDao.upsertByTitleKey({
        titleKey: "rag",
        title: "RAG",
        aliases: ["检索增强生成"],
        mentionDelta: 1,
        relevance: 0.9,
      });
      const second = conceptDao.upsertByTitleKey({
        titleKey: "rag",
        title: "RAG",
        aliases: ["向量检索"],
        mentionDelta: 3,
        relevance: 0.7,
      });

      expect(concepts()).toHaveLength(1);
      expect(second.id).toBe(first.id);
      const saved = conceptDao.findByTitleKey("rag");
      expect(saved).not.toBeNull();
      expect(saved!.title).toBe("RAG");
    });

    it("别名求并集，提及数交由 syncMentionCount 校准而非累加", () => {
      conceptDao.upsertByTitleKey({
        titleKey: "rag",
        title: "RAG",
        aliases: ["Retrieval-Augmented Generation"],
        mentionDelta: 2,
        relevance: 0.9,
      });
      conceptDao.upsertByTitleKey({
        titleKey: "rag",
        title: "RAG",
        aliases: ["retrieval-augmented generation", "检索增强"],
        mentionDelta: 5,
        relevance: 0.8,
      });

      const saved = conceptDao.findByTitleKey("rag")!;
      expect(JSON.parse(saved.aliases)).toEqual([
        "Retrieval-Augmented Generation",
        "检索增强",
      ]);
      // 建行时用本轮提及数播种，合并时不动：累加会在重抽轮翻倍
      expect(saved.mention_count).toBe(2);
    });

    it("UNIQUE(title_key) 让并发重复建行直接失败而非静默膨胀", () => {
      conceptDao.upsertByTitleKey({
        titleKey: "rag",
        title: "RAG",
        aliases: [],
        mentionDelta: 1,
        relevance: 0.9,
      });
      // 绕过 upsert 直接建行：证明唯一约束是真的挡住了第二条同键记录
      expect(() =>
        getDatabase()
          .prepare("INSERT INTO concepts (id, title, title_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
          .run("dup", "RAG", "rag", TS, TS),
      ).toThrow(/UNIQUE constraint failed/);
    });
  });

  describe("syncMentionCount", () => {
    it("以 concept_chunks 行数为准，重抽同一块不翻倍", () => {
      const { id } = conceptDao.upsertByTitleKey({
        titleKey: "rag",
        title: "RAG",
        aliases: [],
        mentionDelta: 1,
        relevance: 0.9,
      });
      conceptChunkDao.upsertAssociation(id, "chunk-1", 0.9);
      conceptDao.syncMentionCount(id);
      expect(conceptDao.findByTitleKey("rag")!.mention_count).toBe(1);

      // 全量重抽：关联靠 ON CONFLICT 幂等，计数重算后仍是 1（累加式会变成 2）
      conceptDao.upsertByTitleKey({
        titleKey: "rag",
        title: "RAG",
        aliases: [],
        mentionDelta: 1,
        relevance: 0.8,
      });
      conceptChunkDao.upsertAssociation(id, "chunk-1", 0.95);
      conceptDao.syncMentionCount(id);
      expect(conceptDao.findByTitleKey("rag")!.mention_count).toBe(1);

      // 只有真正的新块提及才让计数前进
      conceptChunkDao.upsertAssociation(id, "chunk-2", 0.7);
      conceptDao.syncMentionCount(id);
      expect(conceptDao.findByTitleKey("rag")!.mention_count).toBe(2);
    });

    it("空 id 不动数据库", () => {
      expect(conceptDao.syncMentionCount("")).toBe(0);
    });
  });

  describe("upsertAssociation", () => {
    it("同块同概念重复写入只更新相关度，不产生第二行", () => {
      insertConcept("c1", "RAG");
      conceptChunkDao.upsertAssociation("c1", "chunk-1", 0.6);
      conceptChunkDao.upsertAssociation("c1", "chunk-1", 0.9);

      const rows = conceptChunkDao.findBy("concept_id", "c1");
      expect(rows).toHaveLength(1);
      expect(rows[0].relevance_score).toBe(0.9);
    });

    it("新一轮把握度更低时不覆盖既有证据", () => {
      insertConcept("c1", "RAG");
      conceptChunkDao.upsertAssociation("c1", "chunk-1", 0.9);
      conceptChunkDao.upsertAssociation("c1", "chunk-1", 0.5);

      expect(conceptChunkDao.findBy("concept_id", "c1")[0].relevance_score).toBe(0.9);
    });
  });

  describe("dedupeConcepts", () => {
    beforeEach(() => {
      // 旧逻辑留下的脏数据：全半角/大小写/首尾标点各建一行
      insertConcept("c-old", "RAG", "2026-01-02T00:00:00.000Z", 3);
      insertConcept("c-new", "rag。", "2026-01-05T00:00:00.000Z", 4);
      insertConcept("c-db", "向量数据库", "2026-01-03T00:00:00.000Z", 1);
      insertConcept("c-db2", "「向量数据库」。", "2026-01-04T00:00:00.000Z", 2);
      link("c-old", "chunk-1", 0.9);
      link("c-new", "chunk-2", 0.8);
      link("c-db", "chunk-1", 0.7);
      link("c-db2", "chunk-1", 0.95);
      getDatabase()
        .prepare("INSERT INTO topics (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)")
        .run("t1", "主题", TS, TS);
      getDatabase()
        .prepare(
          "INSERT INTO topic_concepts (topic_id, concept_id, created_at, updated_at) VALUES (?, ?, ?, ?)",
        )
        .run("t1", "c-new", TS, TS);
    });

    it("同义概念合并为一行，保留 created_at 最早者为 canonical", () => {
      databaseMigration.dedupeConcepts();

      const rows = concepts();
      expect(rows.map((row) => row.id)).toEqual(["c-old", "c-db"]);
      expect(rows.map((row) => row.title_key)).toEqual(["rag", "向量数据库"]);
    });

    it("块关联整体迁到 canonical，同一块上不覆盖既有相关度", () => {
      databaseMigration.dedupeConcepts();

      expect(conceptChunkDao.findBy("concept_id", "c-old").map((r) => r.chunk_id).sort()).toEqual([
        "chunk-1",
        "chunk-2",
      ]);
      // c-db 与 c-db2 都关联 chunk-1：INSERT OR IGNORE 保留 canonical 的 0.7
      const dbLinks = conceptChunkDao.findBy("concept_id", "c-db");
      expect(dbLinks).toHaveLength(1);
      expect(dbLinks[0].relevance_score).toBe(0.7);
    });

    it("mention_count 汇总，从属行删除后 topic_concepts 级联清理", () => {
      databaseMigration.dedupeConcepts();

      expect(conceptDao.findByTitleKey("rag")!.mention_count).toBe(7);
      const topicConcepts = getDatabase().prepare("SELECT * FROM topic_concepts").all() as Row[];
      expect(topicConcepts).toHaveLength(0);
    });

    it("重建后可按标题检索到存活概念（FTS 必须随表重建）", () => {
      databaseMigration.dedupeConcepts();
      expect(conceptDao.searchFts("向量数据库").map((c) => c.id)).toEqual(["c-db"]);
      expect(conceptDao.searchFts("rag。")).toHaveLength(0);
    });

    it("再跑一次不改变任何行（幂等）", () => {
      databaseMigration.dedupeConcepts();
      const snapshot = concepts();
      databaseMigration.dedupeConcepts();
      expect(concepts()).toEqual(snapshot);
    });

    it("归一后为空的标题不参与去重", () => {
      insertConcept("c-noise", "——", "2026-01-06T00:00:00.000Z");
      databaseMigration.dedupeConcepts();
      expect(concepts().map((row) => row.id)).toContain("c-noise");
    });
  });
});
