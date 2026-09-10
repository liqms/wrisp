import { describe, it, expect } from "vitest";
import { deriveWorkSkill } from "@/main/core/skills/work-skill.deriver";
import type { SkillDefinition } from "@/shared/types/skill.types";
import type { WorkBrief } from "@/shared/types";

const source: SkillDefinition = {
  id: "outline",
  name: { zh: "大纲", en: "Outline" },
  description: { zh: "", en: "" },
  icon: "📝",
  version: "1.2.0",
  author: "wrisp",
  category: ["writing"],
  enabled: true,
  promptTemplate: { zh: "为{{audience}}写大纲", en: "Outline for {{audience}}" },
};

const brief: WorkBrief = {
  name: "长夜",
  type: "novel",
  audience: "青年读者",
  tone: "克制",
};

describe("deriveWorkSkill", () => {
  it("产出独立 id 的作品技能副本", () => {
    const derived = deriveWorkSkill(source, brief, "work-outline");
    expect(derived.id).toBe("work-outline");
    expect(derived.id).not.toBe(source.id);
  });

  it("记录来源模板 id 与版本（供'有更新可用'提示）", () => {
    const derived = deriveWorkSkill(source, brief, "work-outline");
    expect(derived.sourceTemplateId).toBe("outline");
    expect(derived.sourceTemplateVersion).toBe("1.2.0");
  });

  it("把简报信息填入同名输入参数的默认值（仅 string 类型）", () => {
    const withInput: SkillDefinition = {
      ...source,
      input: {
        type: "object",
        properties: {
          audience: { type: "string", default: "" },
          text: { type: "string" },
        },
        required: ["text"],
      },
    };
    const derived = deriveWorkSkill(withInput, brief, "work-outline");

    expect(derived.input?.properties.audience.default).toBe("青年读者");
    expect(derived.input?.properties.text.default).toBeUndefined();
  });

  it("不修改来源技能对象（无副作用）", () => {
    const snapshot = JSON.stringify(source);
    deriveWorkSkill(source, brief, "work-outline");
    expect(JSON.stringify(source)).toBe(snapshot);
  });
});
