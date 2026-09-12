import { describe, it, expect, vi } from "vitest";

// vi.mock 会被提升到文件顶部：工厂引用的变量必须用 vi.hoisted 创建
const { resolveSkillDefinition } = vi.hoisted(() => ({
  resolveSkillDefinition: vi.fn((): unknown => null),
}));

// 单测环境没有 Electron 运行时
vi.mock("electron", () => ({
  app: {
    getAppPath: () => process.cwd(),
    getPath: () => process.cwd(),
  },
}));

vi.mock("@/main/core/skills/skill.manager", () => ({
  skillManager: { resolveSkillDefinition },
}));

// tool.registry 会拉入 material-search.service → chunk.service 等重依赖链
// （曾在 tests/unit/main/tool-registry.test.ts 触发 app.getAppPath 崩溃），
// 这里连同 ai.service 一起 mock，让本测试只关注"解析走了哪条路径"。
vi.mock("@/main/core/skills/tool.registry", () => ({
  toolRegistry: {
    resolveTools: () => [],
    getToolsForLLM: () => [],
    execute: vi.fn(),
  },
}));

vi.mock("@/main/core/services/ai.service", () => ({
  aiService: { chatCompletion: vi.fn() },
}));

import { skillExecutor } from "@/main/core/skills/skill.executor";

describe("SkillExecutor 按作品解析技能", () => {
  it("execute 把 projectId 交给 resolveSkillDefinition", async () => {
    await expect(
      skillExecutor.execute("outline", { text: "x" }, "p1"),
    ).rejects.toThrow("SKILL_NOT_FOUND: outline");

    expect(resolveSkillDefinition).toHaveBeenCalledWith("outline", "p1");
  });
});
