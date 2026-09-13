import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

// 单测环境没有 Electron 运行时：SkillManager / ConfigService 的导入链会触及 app
vi.mock("electron", () => ({
  app: {
    getAppPath: () => process.cwd(),
    getPath: () => process.cwd(),
    isPackaged: false,
  },
  BrowserWindow: {
    getAllWindows: () => [],
  },
}));

vi.mock("@/main/core/db", () => ({
  ProjectDao: class {
    findById = () => null;
  },
}));

vi.mock("@/main/core/skills/project-skill.store", () => ({
  projectSkillStore: {
    list: () => [],
    read: vi.fn(),
    write: vi.fn(),
    remove: vi.fn(),
  },
  getProjectSkillsDir: (p: string) => `${p}/skills`,
}));

// setWorkspace 会关闭数据库连接并执行数据库迁移，单测中替换为轻量实现
vi.mock("@/main/core/db/connection", () => ({
  closeDatabase: vi.fn(),
  setWorkspacePath: (p: string) => {
    (globalThis as Record<string, unknown>).__WRISP_WORKSPACE_PATH__ = p;
  },
}));

vi.mock("@/main/core/migration/database.migration", () => ({
  databaseMigration: { executeDatabaseMigration: vi.fn() },
}));

vi.mock("@/main/core/scheduler/backup.task", () => ({
  BackupTask: { getInstance: () => ({ refreshWorkspace: vi.fn() }) },
}));

import { skillManager } from "@/main/core/skills/skill.manager";
import { configService } from "@/main/core/services/config.service";

/** 在指定工作空间写入一个内置技能（<workspace>/resources/skills/<id>.skill.json） */
function writeBuiltinSkill(workspace: string, skillId: string): void {
  const builtinDir = path.join(workspace, "resources", "skills");
  fs.mkdirSync(builtinDir, { recursive: true });
  fs.writeFileSync(
    path.join(builtinDir, `${skillId}.skill.json`),
    JSON.stringify(
      {
        id: skillId,
        name: { zh: skillId, en: skillId },
        description: { zh: "测试技能", en: "Test skill" },
        icon: "📝",
        version: "1.0.0",
        author: "test",
        category: ["writing"],
        enabled: true,
        promptTemplate: { zh: "{{text}}", en: "{{text}}" },
      },
      null,
      2,
    ),
    "utf-8",
  );
}

function mountWorkspace(skillId: string): string {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "wrisp-ws-"));
  writeBuiltinSkill(workspace, skillId);
  return workspace;
}

function skillIds(): string[] {
  return skillManager.getSkills().map((s) => s.id);
}

describe("SkillManager 随工作空间切换重新初始化", () => {
  it("启动时配置里必有工作空间兜底值", () => {
    // ConfigService.loadConfig 会把空 workspace 兜底为默认目录，
    // 因此 SkillManager.initialize() 里的“无 workspace 跳过”分支在正常流程中不可达
    const workspace = configService.getValue<string>("workspace");
    expect(typeof workspace).toBe("string");
    expect((workspace ?? "").trim()).not.toBe("");
  });

  it("切换工作空间后加载新工作空间的技能，并丢弃旧工作空间的技能", async () => {
    const wsA = mountWorkspace("skill-a");

    // setWorkspace 会在所选目录下再拼一层 Wrisp
    const pickedDir = fs.mkdtempSync(path.join(os.tmpdir(), "wrisp-pick-"));
    writeBuiltinSkill(path.join(pickedDir, "Wrisp"), "skill-b");

    // 启动：工作空间 A
    (globalThis as Record<string, unknown>).__WRISP_WORKSPACE_PATH__ = wsA;
    skillManager.initialize();
    expect(skillIds()).toContain("skill-a");

    // 模拟用户在设置 / 欢迎页切换工作空间
    configService.setWorkspace(pickedDir);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(skillIds()).toContain("skill-b");
    expect(skillIds()).not.toContain("skill-a");
  });
});
