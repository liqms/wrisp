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

import { inlineTokenSyncService } from "@/main/core/services/inline-token-sync.service";
import { TagDao } from "@/main/core/db/tag.dao";
import { CharacterDao } from "@/main/core/db/character.dao";
import { getDatabase } from "@/main/core/db/connection";

describe("InlineTokenSyncService", () => {
  let tagDao: TagDao;
  let characterDao: CharacterDao;
  let projectId: string;

  beforeEach(() => {
    const db = getDatabase();
    db.exec("DELETE FROM tags");
    db.exec("DELETE FROM characters");
    db.exec("DELETE FROM projects");
    // 外键依赖：插入测试作品（projects 必填字段以 init.sql 为准：name 而非 title）
    db.prepare(
      "INSERT INTO projects (id, name, file_path, status, created_at, updated_at) VALUES ('p-test-1', '测试作品', '/tmp/p1', 'active', '2026-09-05T00:00:00.000Z', '2026-09-05T00:00:00.000Z')",
    ).run();
    projectId = "p-test-1";
    tagDao = new TagDao();
    characterDao = new CharacterDao();
  });

  it("同步 #标签 与 @人物 到对应表（默认联系人归属）", () => {
    inlineTokenSyncService.syncFromMarkdown("#科幻 和@张三 讨论了[[计划]]", {
      type: "contact",
    });

    expect(tagDao.findByName("科幻")).not.toBeNull();
    const character = characterDao.findByIdentity("张三", "contact", null);
    expect(character).not.toBeNull();
    expect(character!.owner_id).toBeNull();
  });

  it("作品页面同步时 @人物 归属该作品", () => {
    inlineTokenSyncService.syncFromMarkdown("和@林黛玉 聊了", {
      type: "project",
      id: projectId,
    });

    const character = characterDao.findByIdentity(
      "林黛玉",
      "project",
      projectId,
    );
    expect(character).not.toBeNull();
    expect(character!.owner_type).toBe("project");
    expect(character!.owner_id).toBe(projectId);
  });

  it("重复同步去重，不产生重复记录", () => {
    const md = "#科幻 和@张三 聊天";
    inlineTokenSyncService.syncFromMarkdown(md, { type: "contact" });
    inlineTokenSyncService.syncFromMarkdown(md, { type: "contact" });

    const tags = tagDao.findByNameLike("科幻");
    expect(tags).toHaveLength(1);
    const characters = characterDao.findByNameLike("张三");
    expect(characters).toHaveLength(1);
  });

  it("同名人物不同归属分别入库", () => {
    inlineTokenSyncService.syncFromMarkdown("和@张三 聊天", {
      type: "contact",
    });
    inlineTokenSyncService.syncFromMarkdown("和@张三 聊天", {
      type: "project",
      id: projectId,
    });

    const characters = characterDao.findByNameLike("张三");
    expect(characters).toHaveLength(2);
    expect(characters.filter((c) => c.owner_type === "contact")).toHaveLength(
      1,
    );
    expect(characters.filter((c) => c.owner_type === "project")).toHaveLength(
      1,
    );
  });

  it("空内容与空字符串直接返回，不抛错", () => {
    expect(() => {
      inlineTokenSyncService.syncFromMarkdown("", { type: "contact" });
      inlineTokenSyncService.syncFromMarkdown("   ", { type: "contact" });
      inlineTokenSyncService.syncFromMarkdown("普通文本没有 token", {
        type: "contact",
      });
    }).not.toThrow();
    expect(tagDao.findAll()).toHaveLength(0);
    expect(characterDao.findAll()).toHaveLength(0);
  });

  it("[[双链]] 不入任何表（仅渲染，不持久化）", () => {
    inlineTokenSyncService.syncFromMarkdown("参见[[项目计划]]", {
      type: "contact",
    });
    expect(tagDao.findAll()).toHaveLength(0);
    expect(characterDao.findAll()).toHaveLength(0);
  });
});
