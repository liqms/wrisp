// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { Chunk } from "@/main/types/db";
import {
  buildConceptInput,
  buildConceptMessages,
  ConceptParseError,
  isGeneralConcept,
  parseConceptJson,
} from "@/main/core/smart-tasks/executors/concept-input";
import {
  CONCEPT_MAX_PER_BLOCK,
  CONCEPT_PROMPT_BUDGET_CHARS,
} from "@/main/constants/concept.constants";

function chunk(overrides: Partial<Chunk> = {}): Chunk {
  return {
    id: "b1",
    content: "检索增强生成把语义检索与生成模型串联起来。",
    ai_summary: null,
    section_title: null,
    ...overrides,
  } as Chunk;
}

describe("buildConceptInput", () => {
  it("摘要有独立信息时作为导语，正文取原文窗口", () => {
    const input = buildConceptInput(
      chunk({ ai_summary: "讨论 RAG 的检索-生成串联结构。", content: "x".repeat(3000) }),
      1200,
    );
    expect(input).toBe(`[摘要] 讨论 RAG 的检索-生成串联结构。\n[正文节选] ${"x".repeat(1200)}`);
  });

  it("短块的摘要就是原文时不重复输出", () => {
    const content = "只有一句话。";
    const input = buildConceptInput(chunk({ ai_summary: content, content }), 1200);
    expect(input).toBe(`[正文节选] ${content}`);
  });

  it("无摘要时只输出正文节选", () => {
    expect(buildConceptInput(chunk(), 1200)).toBe("[正文节选] 检索增强生成把语义检索与生成模型串联起来。");
  });
});

describe("buildConceptMessages", () => {
  it("候选概念注入 user 消息", () => {
    const { user } = buildConceptMessages(chunk(), 1200, ["向量数据库", "嵌入模型"]);
    expect(user).toContain("已有概念（优先复用）：向量数据库、嵌入模型");
  });

  it("无候选时写明（无），避免模型读到空白行", () => {
    expect(buildConceptMessages(chunk(), 1200, []).user).toContain("已有概念（优先复用）：（无）");
  });

  it("超预算时先裁候选、再裁窗口，最终不超过 prompt 预算", () => {
    const block = chunk({
      content: "长".repeat(6000),
      ai_summary: "摘要".repeat(60),
    });
    const { system, user } = buildConceptMessages(block, 2400, [
      "概念甲",
      "概念乙",
      "概念丙",
      "概念丁",
      "概念戊",
      "概念己",
      "概念庚",
      "概念辛",
      "概念壬",
    ]);
    expect(system.length + user.length).toBeLessThanOrEqual(CONCEPT_PROMPT_BUDGET_CHARS);
    // 候选被优先裁掉，窗口随后收缩
    expect(user).toContain("已有概念（优先复用）：（无）");
    expect(user.length).toBeLessThan(2400);
  });

  it("候选条数上限生效，多余的不进 prompt", () => {
    const many = Array.from({ length: 20 }, (_, i) => `概念${i}`);
    const { user } = buildConceptMessages(chunk(), 1200, many);
    expect(user).toContain("概念7");
    expect(user).not.toContain("概念19");
  });
});

describe("parseConceptJson", () => {
  const valid = JSON.stringify([
    { title: "检索增强生成", aliases: ["RAG"], evidence: "把语义检索与生成模型串联", confidence: 0.9 },
  ]);

  it("解析纯数组输出", () => {
    expect(parseConceptJson(valid)).toEqual([
      {
        title: "检索增强生成",
        aliases: ["RAG"],
        evidence: "把语义检索与生成模型串联",
        confidence: 0.9,
      },
    ]);
  });

  it("吃掉代码栅栏与前后缀说明", () => {
    const fenced = "以下是结果：\n```json\n" + valid + "\n```\n希望有帮助。";
    expect(parseConceptJson(fenced)).toHaveLength(1);
  });

  it("空数组是合法结果（宁缺毋滥）", () => {
    expect(parseConceptJson("[]")).toEqual([]);
  });

  it("找不到数组时整块失败，不做逗号切分降级", () => {
    expect(() => parseConceptJson("检索增强生成, 向量数据库")).toThrow(ConceptParseError);
    expect(() => parseConceptJson('{"title":"x"}')).toThrow(ConceptParseError);
  });

  it("任一项非法即整块失败", () => {
    const badConfidence = JSON.stringify([{ title: "向量", confidence: 0.2 }]);
    expect(() => parseConceptJson(badConfidence)).toThrow(/confidence/);
    expect(() => parseConceptJson(JSON.stringify([{ confidence: 0.9 }]))).toThrow(/title/);
    expect(() => parseConceptJson(JSON.stringify(["检索增强"]))).toThrow(/不是对象/);
  });

  it("超过条数上限的部分丢弃", () => {
    const many = JSON.stringify(
      Array.from({ length: CONCEPT_MAX_PER_BLOCK + 3 }, (_, i) => ({
        title: `概念${i}`,
        confidence: 0.8,
      })),
    );
    expect(parseConceptJson(many)).toHaveLength(CONCEPT_MAX_PER_BLOCK);
  });

  it("别名按归一化键去重，evidence 超长截断", () => {
    // 第三项与第一项经 NFKC（全角转半角、表意空格转普通空格）后同键
    const fullWidth = "ＶＥＣＴＯＲ\u3000ＤＢ";
    const [concept] = parseConceptJson(
      JSON.stringify([
        {
          title: "向量数据库",
          aliases: ["Vector DB", "向量数据库", fullWidth, ""],
          evidence: "证".repeat(60),
          confidence: 0.7,
        },
      ]),
    );
    // 空串忽略；与 title 同键的别名不在解析层剔除，由执行器聚合阶段负责。
    expect(concept.aliases).toEqual(["Vector DB", "向量数据库"]);
    expect(concept.evidence).toHaveLength(30);
  });
});

describe("isGeneralConcept", () => {
  it("命中泛化词表（含带标点的写法）", () => {
    expect(isGeneralConcept("方法")).toBe(true);
    expect(isGeneralConcept("「问题」。")).toBe(true);
  });

  it("具体概念不受影响", () => {
    expect(isGeneralConcept("检索增强生成")).toBe(false);
    expect(isGeneralConcept("方法论")).toBe(false);
  });
});
