import { describe, it, expect, vi } from "vitest";

// vi.mock 提升：工厂引用的变量必须先用 vi.hoisted 创建
const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  profileMerge: vi.fn(),
  projectSkillWrite: vi.fn(),
  getSkillDefinition: vi.fn(),
}));

vi.mock("@/main/core/db", () => ({
  ProjectDao: class {
    findById = mocks.findById;
  },
}));

vi.mock("@/main/core/services/work-profile.store", () => ({
  workProfileStore: {
    merge: mocks.profileMerge,
    write: vi.fn(),
    read: () => ({}),
  },
}));

vi.mock("@/main/core/skills/project-skill.store", () => ({
  projectSkillStore: {
    write: mocks.projectSkillWrite,
    list: vi.fn(() => []),
    read: vi.fn(() => null),
    remove: vi.fn(),
  },
}));

vi.mock("@/main/core/skills/skill.manager", () => ({
  skillManager: {
    getSkillDefinition: mocks.getSkillDefinition,
    invalidateProjectSkills: vi.fn(),
  },
}));

import { workCreationService } from "@/main/core/services/work-creation.service";

const SOURCE_SKILL = {
  id: "outline",
  name: { zh: "大纲", en: "Outline" },
  description: { zh: "", en: "" },
  icon: "📝",
  version: "1.0.0",
  author: "wrisp",
  category: ["writing"],
  enabled: true,
  promptTemplate: { zh: "{{text}}", en: "{{text}}" },
};

describe("workCreationService.finishCreation", () => {
  it("写入简报并自动派生出作品技能（无确认门）", () => {
    mocks.findById.mockReturnValue({
      id: "p1",
      file_path: "D:/proj/p1/",
      type: "novel",
    });
    mocks.getSkillDefinition.mockReturnValue(SOURCE_SKILL);

    const result = workCreationService.finishCreation("p1", {
      name: "长夜",
      audience: "青年读者",
    });

    expect(result.brief.name).toBe("长夜");
    expect(mocks.profileMerge).toHaveBeenCalled();
    expect(mocks.projectSkillWrite).toHaveBeenCalled();
    expect(result.derivedSkillIds.length).toBeGreaterThan(0);
  });

  it("作品不存在时抛错", () => {
    mocks.findById.mockReturnValueOnce(null);
    expect(() => workCreationService.finishCreation("nope", {})).toThrow(
      "PROJECT_NOT_FOUND",
    );
  });

  it("全局技能缺失时跳过该技能，不阻断作品创建", () => {
    mocks.findById.mockReturnValue({
      id: "p2",
      file_path: "D:/proj/p2/",
      type: "novel",
    });
    mocks.getSkillDefinition.mockReturnValue(null);

    const result = workCreationService.finishCreation("p2", { name: "x" });

    expect(result.derivedSkillIds).toEqual([]);
    expect(mocks.profileMerge).toHaveBeenCalled();
  });
});
