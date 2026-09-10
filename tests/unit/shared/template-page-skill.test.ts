import { describe, it, expect } from "vitest";
import type { TemplateResourceFile } from "@/shared/types/template.types";

// 类型契约测试：运行时断言恒真，行为回归不会在此失败。不计入行为覆盖。

describe("TemplateResourceFile.skills", () => {
  it("可声明页面级技能（引用技能 id + 参数 + 是否确认）", () => {
    const tpl = {
      id: "page-prd",
      version: "1.0.0",
      title: { zh: "PRD", en: "PRD" },
      description: { zh: "", en: "" },
      icon: "fact_check",
      markdown: { zh: "", en: "" },
      profession: ["pm"],
      tags: [],
      enabled: true,
      skills: [
        {
          id: "ask-overview",
          skillId: "outline",
          params: { style: "prd" },
          requiresConfirm: true,
        },
      ],
    } satisfies TemplateResourceFile;

    expect(tpl.skills?.[0].skillId).toBe("outline");
  });
});
