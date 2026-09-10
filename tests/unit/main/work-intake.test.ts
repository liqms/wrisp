import { describe, it, expect } from "vitest";
import {
  buildIntakeQuestions,
  answersToWorkBrief,
} from "@/main/core/services/work-intake";
import { PROJECT_TYPE } from "@/shared/enums/project.enums";

describe("work-intake", () => {
  it("问题清单必含作品名与通用基础项", () => {
    const keys = buildIntakeQuestions(PROJECT_TYPE.NOVEL).map((q) => q.key);
    expect(keys).toContain("name");
    expect(keys).toContain("audience");
  });

  it("研究类作品会追问参考文献，小说类不会", () => {
    const research = buildIntakeQuestions(PROJECT_TYPE.RESEARCH).map(
      (q) => q.key,
    );
    const novel = buildIntakeQuestions(PROJECT_TYPE.NOVEL).map((q) => q.key);
    expect(research).toContain("references");
    expect(novel).not.toContain("references");
  });

  it("answersToWorkBrief 把 answers 归集为 WorkBrief（多值按逗号拆分）", () => {
    const brief = answersToWorkBrief(PROJECT_TYPE.NOVEL, {
      name: "长夜",
      audience: "青年",
      tone: "克制",
      themes: "成长, 离别",
    });
    expect(brief.name).toBe("长夜");
    expect(brief.type).toBe(PROJECT_TYPE.NOVEL);
    expect(brief.themes).toEqual(["成长", "离别"]);
  });

  it("空答案不注入空串字段", () => {
    const brief = answersToWorkBrief(PROJECT_TYPE.NOVEL, {
      name: "x",
      audience: "   ",
    });
    expect("audience" in brief).toBe(false);
  });
});
