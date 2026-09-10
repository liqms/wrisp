# 审核与委托 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付"委托自动审核"的判定内核：解析 Reviewer 输出、检测硬约束命中、把打回理由转成局部修正指令，最终由确认门策略给出结果。

**Architecture:** 四块纯函数 + 一层薄编排。Reviewer 的 **LLM 调用不在本计划**——本计划接收其原始输出文本。

**Tech Stack:** TypeScript（strict）、Vitest。

**Spec:** `docs/superpowers/specs/2026-09-10-creation-agent-design.md`（§6.1 确认门与委托）

## Global Constraints

- Node.js 24+，包管理用 pnpm。
- TypeScript 严格模式：`noUnusedLocals` 与 `noUnusedParameters` 严格。
- 测试用 Vitest，`globals: true`、`environment: happy-dom`；放 `tests/unit/**`。
- **保守回退**：不确定即 `needs-user`。
- **硬约束永不自动放行**：命中即回退，`lenient` 档也不免除。
- **打回可逆**：`reject` 须带具体问题，作为局部修正指令。

## 前置依赖

| 计划 | 用到的产出 |
|---|---|
| 创作会话与确认门 | `decideGateOutcome`、`ReviewStrictness`、`GateKind` |
| 偏好与风格记忆 | `buildReviewCriteria`（用于组装 Reviewer 提示词，接线层使用） |
| 作品采集与技能派生 | `WorkStyle`（硬约束来源） |

---

### Task 1: Reviewer 输出解析（纯函数）

**Files:**
- Create: `src/main/core/services/review-outcome.ts`
- Test: `tests/unit/main/review-outcome.test.ts`

**Interfaces:**
- Produces: `ReviewOutcome`、`parseReviewOutcome(raw: string): ReviewOutcome`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from "vitest";
import { parseReviewOutcome } from "@/main/core/services/review-outcome";

describe("parseReviewOutcome", () => {
  it("解析普通 JSON 输出", () => {
    const out = parseReviewOutcome(
      '{"decision":"approve","confidence":0.92,"issues":[]}',
    );
    expect(out.decision).toBe("approve");
    expect(out.confidence).toBe(0.92);
  });

  it("解析被 Markdown 代码块包裹的 JSON", () => {
    const out = parseReviewOutcome(
      '```json\n{"decision":"reject","confidence":0.4,"issues":["节奏拖沓"]}\n```',
    );
    expect(out.decision).toBe("reject");
    expect(out.issues).toEqual(["节奏拖沓"]);
  });

  it("无法解析时保守回退为 needs-user 且置信度 0", () => {
    const out = parseReviewOutcome("模型今天不想干活");
    expect(out.decision).toBe("needs-user");
    expect(out.confidence).toBe(0);
  });

  it("decision 非法值一律回退 needs-user", () => {
    expect(parseReviewOutcome('{"decision":"maybe"}').decision).toBe("needs-user");
  });

  it("置信度越界会被夹到 0..1", () => {
    expect(parseReviewOutcome('{"decision":"approve","confidence":3}').confidence).toBe(1);
    expect(parseReviewOutcome('{"decision":"approve","confidence":-1}').confidence).toBe(0);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/review-outcome.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现解析**

```ts
// src/main/core/services/review-outcome.ts
export interface ReviewOutcome {
  decision: "approve" | "reject" | "needs-user";
  /** 0..1 */
  confidence: number;
  /** 打回时的具体问题（用于构造局部修正指令） */
  issues: string[];
}

const FALLBACK: ReviewOutcome = { decision: "needs-user", confidence: 0, issues: [] };

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), 1);
}

function extractJson(raw: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

/** 解析 Reviewer 原始输出；任何无法识别的情况保守回退为 needs-user。 */
export function parseReviewOutcome(raw: string): ReviewOutcome {
  const json = extractJson(raw ?? "");
  if (!json) return { ...FALLBACK };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ...FALLBACK };
  }
  if (!parsed || typeof parsed !== "object") return { ...FALLBACK };

  const obj = parsed as Record<string, unknown>;
  const decision = obj.decision;
  if (decision !== "approve" && decision !== "reject" && decision !== "needs-user") {
    return { ...FALLBACK };
  }

  const confidence = typeof obj.confidence === "number" ? clamp01(obj.confidence) : 0;
  const issues = Array.isArray(obj.issues)
    ? obj.issues.filter((i): i is string => typeof i === "string" && i.trim() !== "")
    : [];

  return { decision, confidence, issues };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/review-outcome.test.ts`
Expected: PASS（5 个用例）

- [ ] **Step 5: 类型检查与提交**

```bash
git add src/main/core/services/review-outcome.ts tests/unit/main/review-outcome.test.ts
git commit -m "feat: 新增 Reviewer 输出解析（解析失败保守回退）"
```

---

### Task 2: 硬约束命中检测（纯函数）

**Files:**
- Create: `src/main/core/services/hard-constraint.ts`
- Test: `tests/unit/main/hard-constraint.test.ts`

**Interfaces:**
- Produces: `HardConstraintSet`、`ConstraintHit`、`detectHardConstraintHit(text, set)`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from "vitest";
import { detectHardConstraintHit } from "@/main/core/services/hard-constraint";

describe("detectHardConstraintHit", () => {
  it("命中禁忌词时返回命中项", () => {
    const hit = detectHardConstraintHit("他开始了暴力反击", { taboos: ["暴力"] });
    expect(hit?.constraint).toBe("暴力");
    expect(hit?.kind).toBe("taboo");
  });

  it("命中禁用词时归为 constraint", () => {
    const hit = detectHardConstraintHit("他掏出手机刷短视频", {
      forbiddenWords: ["手机", "短视频"],
    });
    expect(hit?.kind).toBe("constraint");
  });

  it("glossaryMustMatch 为真时出现专名即命中", () => {
    const hit = detectHardConstraintHit("他称其为「灰烬纪元」", {
      glossary: [{ term: "灰烬纪元", definition: "时代名" }],
      glossaryMustMatch: true,
    });
    expect(hit?.kind).toBe("glossary");
  });

  it("无命中或空约束集时返回 null", () => {
    expect(detectHardConstraintHit("一切正常", { taboos: ["暴力"] })).toBeNull();
    expect(detectHardConstraintHit("任意文本", {})).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/hard-constraint.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现检测**

```ts
// src/main/core/services/hard-constraint.ts
export interface HardConstraintSet {
  taboos?: string[];
  constraints?: string[];
  forbiddenWords?: string[];
  glossary?: Array<{ term: string; definition: string }>;
  /** 为真时：出现 glossary 中的专名即视为命中（用于"专名不得改动"类约束） */
  glossaryMustMatch?: boolean;
}

export interface ConstraintHit {
  kind: "taboo" | "constraint" | "glossary";
  constraint: string;
}

/**
 * 检测文本是否命中硬约束。命中即"永不自动放行"，交回人工（spec §6.1）。
 */
export function detectHardConstraintHit(
  text: string,
  set: HardConstraintSet,
): ConstraintHit | null {
  if (!text) return null;

  for (const taboo of set.taboos ?? []) {
    if (taboo && text.includes(taboo)) return { kind: "taboo", constraint: taboo };
  }
  for (const word of set.forbiddenWords ?? []) {
    if (word && text.includes(word)) return { kind: "constraint", constraint: word };
  }
  for (const rule of set.constraints ?? []) {
    if (rule && text.includes(rule)) return { kind: "constraint", constraint: rule };
  }
  if (set.glossaryMustMatch) {
    for (const entry of set.glossary ?? []) {
      if (entry.term && text.includes(entry.term)) {
        return { kind: "glossary", constraint: entry.term };
      }
    }
  }
  return null;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/hard-constraint.test.ts`
Expected: PASS（4 个用例）

- [ ] **Step 5: 类型检查与提交**

```bash
git add src/main/core/services/hard-constraint.ts tests/unit/main/hard-constraint.test.ts
git commit -m "feat: 新增硬约束命中检测"
```

---

### Task 3: 打回 → 局部修正指令（纯函数）

**Files:**
- Create: `src/main/core/services/revision-instruction.ts`
- Test: `tests/unit/main/revision-instruction.test.ts`

**Interfaces:**
- Produces: `buildRevisionInstruction(issues: string[]): string`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from "vitest";
import { buildRevisionInstruction } from "@/main/core/services/revision-instruction";

describe("buildRevisionInstruction", () => {
  it("把问题清单组织为局部修正指令", () => {
    const instruction = buildRevisionInstruction(["节奏拖沓", "对话生硬"]);
    expect(instruction).toContain("节奏拖沓");
    expect(instruction).toContain("对话生硬");
    expect(instruction).toContain("仅修改");
  });

  it("无有效问题时返回空串", () => {
    expect(buildRevisionInstruction([])).toBe("");
    expect(buildRevisionInstruction(["  "])).toBe("");
  });

  it("去重相同问题", () => {
    expect(buildRevisionInstruction(["太啰嗦", "太啰嗦"]).match(/太啰嗦/g)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/revision-instruction.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现指令构造**

```ts
// src/main/core/services/revision-instruction.ts
/**
 * 把打回理由组织为"局部修正"指令。
 * 明确要求只改被点名之处，避免模型借机整段重写、破坏已被认可的部分。
 */
export function buildRevisionInstruction(issues: string[]): string {
  const unique = [...new Set(issues.map((i) => i.trim()).filter(Boolean))];
  if (unique.length === 0) return "";

  const list = unique.map((i) => `- ${i}`).join("\n");
  return [
    "请仅修改以下问题，其余内容保持不变：",
    list,
    "不要重写未被提到的部分。",
  ].join("\n");
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/revision-instruction.test.ts`
Expected: PASS（3 个用例）

- [ ] **Step 5: 类型检查与提交**

```bash
git add src/main/core/services/revision-instruction.ts tests/unit/main/revision-instruction.test.ts
git commit -m "feat: 新增打回理由到局部修正指令的构造"
```

---

### Task 4: 审核编排（委托判定）

**Files:**
- Create: `src/main/core/services/review.service.ts`
- Test: `tests/unit/main/review.service.test.ts`

**Interfaces:**
- Consumes: Task 1–3；`decideGateOutcome`
- Produces: `ReviewInput`、`ReviewDecision`、`reviewService.evaluateAndDecide(input)`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from "vitest";
import { reviewService } from "@/main/core/services/review.service";

const base = {
  rawReview: '{"decision":"approve","confidence":0.95,"issues":[]}',
  text: "一段正常产出",
  constraints: { taboos: ["暴力"] },
  session: { delegation: { section: true } },
  kind: "section" as const,
  reviewStrictness: "normal" as const,
  calibrated: true,
};

describe("reviewService.evaluateAndDecide", () => {
  it("高置信且无硬约束命中时放行", () => {
    expect(reviewService.evaluateAndDecide(base).outcome).toBe("approve");
  });

  it("命中硬约束时回退人工（即使 Reviewer 说 approve）", () => {
    const result = reviewService.evaluateAndDecide({ ...base, text: "他开始了暴力反击" });
    expect(result.outcome).toBe("needs-user");
    expect(result.hit?.constraint).toBe("暴力");
  });

  it("未委托该步骤时回退人工", () => {
    const result = reviewService.evaluateAndDecide({
      ...base,
      session: { delegation: {} },
    });
    expect(result.outcome).toBe("needs-user");
  });

  it("Reviewer 判 reject 时透传问题清单并给出修正指令", () => {
    const result = reviewService.evaluateAndDecide({
      ...base,
      rawReview: '{"decision":"reject","confidence":0.5,"issues":["节奏拖沓"]}',
    });
    expect(result.reviewerDecision).toBe("reject");
    expect(result.revisionInstruction).toContain("节奏拖沓");
  });

  it("原始输出不可识别时回退人工", () => {
    const result = reviewService.evaluateAndDecide({ ...base, rawReview: "跑飞了" });
    expect(result.outcome).toBe("needs-user");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/review.service.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现编排**

```ts
// src/main/core/services/review.service.ts
import {
  decideGateOutcome,
  type ReviewStrictness,
} from "@/main/core/skills/gate-policy";
import { parseReviewOutcome } from "./review-outcome";
import {
  detectHardConstraintHit,
  type ConstraintHit,
  type HardConstraintSet,
} from "./hard-constraint";
import { buildRevisionInstruction } from "./revision-instruction";
import type { GateKind } from "@/shared/types";

export interface ReviewInput {
  rawReview: string;
  text: string;
  constraints: HardConstraintSet;
  session: { delegation: Partial<Record<GateKind, boolean>> };
  kind: GateKind;
  reviewStrictness: ReviewStrictness;
  calibrated: boolean;
}

export interface ReviewDecision {
  /** 最终结果：approve=自动放行；needs-user=交回人工 */
  outcome: "approve" | "needs-user";
  reviewerDecision: "approve" | "reject" | "needs-user";
  issues: string[];
  hit: ConstraintHit | null;
  /** 打回时供重写使用的局部修正指令 */
  revisionInstruction: string;
}

/**
 * 审核编排：解析 Reviewer 输出 → 检测硬约束 → 交确认门策略判定。
 * 保守规则：
 *   1) 硬约束命中一律回退人工，不进入策略；
 *   2) Reviewer 未判 approve 时透传其判定，不自动放行；
 *   3) 其余交给 decideGateOutcome（委托开关 / 严格度 / 置信度 / 校准）。
 */
class ReviewService {
  private static instance: ReviewService | null = null;

  public static getInstance(): ReviewService {
    if (!ReviewService.instance) {
      ReviewService.instance = new ReviewService();
    }
    return ReviewService.instance;
  }

  public evaluateAndDecide(input: ReviewInput): ReviewDecision {
    const reviewer = parseReviewOutcome(input.rawReview);
    const hit = detectHardConstraintHit(input.text, input.constraints);
    const issues = reviewer.issues;
    const revisionInstruction = buildRevisionInstruction(issues);

    if (hit) {
      return {
        outcome: "needs-user",
        reviewerDecision: reviewer.decision,
        issues,
        hit,
        revisionInstruction,
      };
    }

    if (reviewer.decision !== "approve") {
      return {
        outcome: "needs-user",
        reviewerDecision: reviewer.decision,
        issues,
        hit: null,
        revisionInstruction,
      };
    }

    const outcome = decideGateOutcome({
      kind: input.kind,
      delegated: input.session.delegation[input.kind] === true,
      reviewStrictness: input.reviewStrictness,
      hitHardConstraint: false,
      confidence: reviewer.confidence,
      calibrated: input.calibrated,
    });

    return {
      outcome,
      reviewerDecision: reviewer.decision,
      issues,
      hit: null,
      revisionInstruction,
    };
  }
}

export const reviewService = ReviewService.getInstance();
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/review.service.test.ts`
Expected: PASS（5 个用例）

- [ ] **Step 5: 类型检查与提交**

```bash
git add src/main/core/services/review.service.ts tests/unit/main/review.service.test.ts
git commit -m "feat: 新增审核编排（委托判定与保守回退）"
```

---

## 本计划不包含

- **Reviewer 的 LLM 调用**：本计划接收其原始输出文本；提示词组装（含 `buildReviewCriteria` 产物）与 `aiService.chatCompletion` 调用属接线层。
- **确认门开关与落库**：由 `creationSessionService.openGate/resolveGate` 负责。
- **委托开关的 UI**：随 UI 接线计划接入。

## 风险与开放问题

| 风险 | 说明 | 缓解 |
|---|---|---|
| 模型输出格式漂移 | 解析依赖 JSON 结构 | 解析失败一律回退 `needs-user`，最坏是多问用户，不会误放行 |
| 硬约束靠字面包含 | 同义改写可绕过（"打斗"绕过"暴力"） | 首版作兜底防线；后续可加模型判定，接口不变 |
| 关键词误报 | 正常内容含禁忌词会被回退 | 回退代价是"多问一次"，符合保守基调 |
| `glossaryMustMatch` 语义易混 | 为真时"出现专名即命中" | 字段注释已写明用途，调用方需显式设置 |
