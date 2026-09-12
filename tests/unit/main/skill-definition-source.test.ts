import { describe, it, expect } from "vitest";
import type { SkillDefinition } from "@/shared/types/skill.types";

// 类型契约测试：运行时断言恒真，行为回归不会在此失败。不计入行为覆盖。

describe("SkillDefinition 作品来源元数据", () => {
  it("允许携带 sourceTemplateId / sourceTemplateVersion", () => {
    const skill = {
      id: "work-outline",
      name: { zh: "大纲", en: "Outline" },
      description: { zh: "生成大纲", en: "Generate outline" },
      icon: "📝",
      version: "1.0.0",
      author: "wrisp",
      category: ["writing"],
      enabled: true,
      promptTemplate: { zh: "{{text}}", en: "{{text}}" },
      sourceTemplateId: "outline",
      sourceTemplateVersion: "1.0.0",
    } satisfies SkillDefinition;

    expect(skill.sourceTemplateId).toBe("outline");
    expect(skill.sourceTemplateVersion).toBe("1.0.0");
  });
});
