import { describe, it, expect } from "vitest";
import { parseTemplateResource } from "@/main/core/services/template-resource.parser";

describe("parseTemplateResource", () => {
  it("保留 skills 字段", () => {
    const parsed = parseTemplateResource({
      id: "page-prd",
      version: "1.0.0",
      title: { zh: "PRD", en: "PRD" },
      description: { zh: "", en: "" },
      icon: "fact_check",
      markdown: { zh: "# 标题", en: "# Title" },
      profession: ["pm"],
      tags: [],
      enabled: true,
      skills: [{ id: "s1", skillId: "outline" }],
    });

    expect(parsed?.skills).toHaveLength(1);
    expect(parsed?.skills?.[0].skillId).toBe("outline");
  });

  it("缺少 id 时返回 null", () => {
    expect(parseTemplateResource({ version: "1.0.0" })).toBeNull();
  });

  it("既有两个行为不回归：profession 过滤掉 custom，非法 icon 回退默认值", () => {
    const parsed = parseTemplateResource({
      id: "t",
      icon: "not-a-real-icon",
      profession: ["custom", "pm"],
    });

    expect(parsed?.profession).toEqual(["pm"]);
    expect(parsed?.icon).toBe("description");
  });

  it("无 skills 时该字段为 undefined（不注入空数组）", () => {
    expect(parseTemplateResource({ id: "t" })?.skills).toBeUndefined();
  });
});
