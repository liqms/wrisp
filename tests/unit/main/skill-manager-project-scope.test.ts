import { describe, it, expect, vi } from "vitest";

// vi.mock 会被提升到文件顶部，工厂里引用的变量必须先用 vi.hoisted 创建，
// 否则会抛 "Cannot access 'xxx' before initialization"。
const { findById, storeList } = vi.hoisted(() => ({
  findById: vi.fn(),
  storeList: vi.fn((): unknown[] => []),
}));

// 单测环境没有 Electron 运行时：SkillManager 的导入链会触及 app（schema 路径解析）
vi.mock("electron", () => ({
  app: {
    getAppPath: () => process.cwd(),
    getPath: () => process.cwd(),
  },
}));

vi.mock("@/main/core/db", () => ({
  ProjectDao: class {
    findById = findById;
  },
}));

vi.mock("@/main/core/skills/project-skill.store", () => ({
  projectSkillStore: {
    list: storeList,
    read: vi.fn(),
    write: vi.fn(),
    remove: vi.fn(),
  },
  getProjectSkillsDir: (p: string) => `${p}/skills`,
}));

import { skillManager } from "@/main/core/skills/skill.manager";
import type { SkillDefinition } from "@/shared/types/skill.types";

const workSkill: SkillDefinition = {
  id: "outline",
  name: { zh: "作品大纲", en: "Work outline" },
  description: { zh: "", en: "" },
  icon: "📝",
  version: "1.0.0",
  author: "t",
  category: ["writing"],
  enabled: true,
  promptTemplate: { zh: "work", en: "work" },
  sourceTemplateId: "outline",
  sourceTemplateVersion: "1.0.0",
};

describe("SkillManager 两级解析", () => {
  it("作品技能存在时优先于全局", () => {
    findById.mockReturnValue({ id: "p1", file_path: "D:/proj/p1/" });
    storeList.mockReturnValue([workSkill]);
    skillManager.invalidateProjectSkills("p1");

    const resolved = skillManager.resolveSkillDefinition("outline", "p1");

    expect(resolved?.promptTemplate).toEqual({ zh: "work", en: "work" });
  });

  it("作品技能缺失时回退全局（全局为空则返回 null）", () => {
    findById.mockReturnValue({ id: "p2", file_path: "D:/proj/p2/" });
    storeList.mockReturnValue([]);
    skillManager.invalidateProjectSkills("p2");

    expect(skillManager.resolveSkillDefinition("does-not-exist", "p2")).toBeNull();
  });

  it("未传 projectId 时只查全局，不读作品技能", () => {
    storeList.mockClear();

    expect(skillManager.resolveSkillDefinition("does-not-exist")).toBeNull();
    expect(storeList).not.toHaveBeenCalled();
  });

  it("项目不存在时返回 null，不静默降级为全局", () => {
    findById.mockReturnValueOnce(null);
    skillManager.invalidateProjectSkills("p-missing");

    expect(
      skillManager.resolveSkillDefinition("outline", "p-missing"),
    ).toBeNull();
  });
});
