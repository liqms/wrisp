// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/tmp"),
    getVersion: vi.fn(() => "1.0.0"),
    getName: vi.fn(() => "Wrisp"),
    on: vi.fn(),
  },
  BrowserWindow: vi.fn(),
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() },
}));
vi.mock("@/main/utils/logger", () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}));
vi.mock("winston", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  format: {
    combine: vi.fn(),
    timestamp: vi.fn(),
    printf: vi.fn(),
    colorize: vi.fn(),
    simple: vi.fn(),
    json: vi.fn(),
  },
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
  if (fs.existsSync(schemaPath)) {
    memDb.exec(fs.readFileSync(schemaPath, "utf-8"));
  }
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

import { CharacterDao } from "@/main/core/db/character.dao";
import { getDatabase } from "@/main/core/db/connection";

describe("CharacterDao", () => {
  let dao: CharacterDao;
  let projectId: string;

  beforeEach(() => {
    const db = getDatabase();
    db.exec("DELETE FROM characters");
    db.exec("DELETE FROM projects");
    // 外键依赖：插入测试作品（projects 必填字段以 init.sql 为准：name 而非 title）
    db.prepare(
      "INSERT INTO projects (id, name, file_path, status, created_at, updated_at) VALUES ('p-test-1', '测试作品', '/tmp/p1', 'active', '2026-09-05T00:00:00.000Z', '2026-09-05T00:00:00.000Z')",
    ).run();
    projectId = "p-test-1";
    dao = new CharacterDao();
  });

  it("should create a character with generated UUID", () => {
    const id = dao.create({ name: "张三" });
    expect(id).toBeDefined();

    const saved = dao.findById(id);
    expect(saved).not.toBeNull();
    expect(saved!.name).toBe("张三");
    expect(saved!.owner_type).toBe("contact");
    expect(saved!.owner_id).toBeNull();
    expect(saved!.metadata).toBe("{}");
    expect(saved!.created_at).toBeDefined();
    expect(saved!.updated_at).toBeDefined();
  });

  it("should create a project-owned character with owner_id", () => {
    const id = dao.create({
      name: "林黛玉",
      owner_type: "project",
      owner_id: projectId,
    });
    const saved = dao.findById(id);
    expect(saved!.owner_type).toBe("project");
    expect(saved!.owner_id).toBe(projectId);
  });

  it("should find a character by identity (name + owner)", () => {
    dao.create({ name: "张三" });
    dao.create({ name: "张三", owner_type: "project", owner_id: projectId });

    const contact = dao.findByIdentity("张三", "contact", null);
    expect(contact).not.toBeNull();
    expect(contact!.owner_type).toBe("contact");

    const owned = dao.findByIdentity("张三", "project", projectId);
    expect(owned).not.toBeNull();
    expect(owned!.owner_type).toBe("project");
  });

  it("should return null for non-existent identity", () => {
    expect(dao.findByIdentity("不存在的人", "contact", null)).toBeNull();
  });

  it("should enforce identity uniqueness via expression index", () => {
    dao.create({ name: "张三" });
    expect(() => dao.create({ name: "张三" })).toThrow();
    // 同名但不同归属可共存
    expect(() =>
      dao.create({ name: "张三", owner_type: "project", owner_id: projectId }),
    ).not.toThrow();
  });

  it("should cascade delete project-owned characters when project is deleted", () => {
    dao.create({ name: "王五", owner_type: "project", owner_id: projectId });
    const db = getDatabase();
    db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
    expect(dao.findByIdentity("王五", "project", projectId)).toBeNull();
  });

  it("should find characters by name with LIKE", () => {
    dao.create({ name: "张三" });
    dao.create({ name: "张三丰" });
    dao.create({ name: "李四" });

    const results = dao.findByNameLike("张三");
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.name).sort()).toEqual(["张三", "张三丰"]);
  });

  it("should escape LIKE wildcards in query", () => {
    dao.create({ name: "a%c" });
    const results = dao.findByNameLike("%");
    expect(results.map((r) => r.name)).toEqual(["a%c"]);
  });

  it("should respect limit in LIKE query", () => {
    for (let i = 1; i <= 10; i++) {
      dao.create({ name: `人物-${i}` });
    }
    expect(dao.findByNameLike("人物", 5)).toHaveLength(5);
  });
});
