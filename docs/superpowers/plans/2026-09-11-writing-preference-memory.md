# 偏好与风格记忆 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让创作智能体记住用户的写作偏好，并在三个时机发挥作用——**生成时注入**、**审核时作为判定标准**、**反馈时提议更新**（先建议、后确认，不静默改）。

**Architecture:** 用户写作偏好（跨作品）落在 `AppConfig.writingPreference`。本计划交付四块**纯函数**：生成用的提示片段、从反馈提取偏好信号、信号去重合并、审核判定标准；落库由薄服务调用 `configService` 完成。作品简报与作品风格的注入**已在 P4 的 `buildPageWriteInputs` 实现**，本计划不重复。

**Tech Stack:** TypeScript（strict）、electron-store（`configService`）、Vitest。

**Spec:** `docs/superpowers/specs/2026-09-10-creation-agent-design.md`（§6.3 记忆写入与注入、§4.3 UserWritingPreference / WorkStyle）

## Global Constraints

- Node.js 24+，包管理用 pnpm。
- TypeScript 严格模式：`noUnusedLocals` 与 `noUnusedParameters` 严格。
- 测试用 Vitest，`globals: true`、`environment: happy-dom`；放 `tests/unit/**`。
- **偏好写入必须"先建议、后确认"**，不得静默修改用户画像（spec §6.3）。
- **硬约束永不自动放行**：`taboos` 命中即回退人工（与确认门策略一致）。
- 单测环境无 Electron 运行时；导入链触及 `app` 时用 `vi.mock("electron", …)` 切断。

## 前置依赖

创作会话与确认门计划：提供 `AppConfig.writingPreference` 配置项与默认值。

## 与 P4 的分工（避免重复实现）

- 作品简报 `WorkBrief` / 作品风格 `WorkStyle` 注入技能输入 —— 归 **P4**（`buildPageWriteInputs`）。
- 用户级 `UserWritingPreference` 注入、反馈提取、审核标准 —— 归 **本计划**。

两者由调用方合并成一次技能调用；本计划不修改 `buildPageWriteInputs`。

---

### Task 1: 偏好注入片段（生成时）

**Files:**
- Create: `src/main/core/services/preference-fragment.ts`
- Test: `tests/unit/main/preference-fragment.test.ts`

**Interfaces:**
- Produces: `WritingPreference`、`buildPreferenceFragment(pref: WritingPreference | undefined): string`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from "vitest";
import { buildPreferenceFragment } from "@/main/core/services/preference-fragment";

describe("buildPreferenceFragment", () => {
  it("无偏好时返回空串（不注入噪音）", () => {
    expect(buildPreferenceFragment(undefined)).toBe("");
    expect(buildPreferenceFragment({ reviewStrictness: "normal" })).toBe("");
  });

  it("把已填写的偏好组织为可读片段", () => {
    const fragment = buildPreferenceFragment({
      tone: "克制",
      pov: "第一人称",
      pacing: "缓",
      reviewStrictness: "normal",
    });
    expect(fragment).toContain("基调：克制");
    expect(fragment).toContain("视角：第一人称");
    expect(fragment).toContain("节奏：缓");
  });

  it("禁忌与用词偏好以列表形式出现", () => {
    const fragment = buildPreferenceFragment({
      taboos: ["暴力", "说教"],
      vocabulary: ["克制", "留白"],
      reviewStrictness: "normal",
    });
    expect(fragment).toContain("禁忌：暴力、说教");
    expect(fragment).toContain("用词偏好：克制、留白");
  });

  it("reviewStrictness 属审核设定，不进入生成片段", () => {
    const fragment = buildPreferenceFragment({
      tone: "克制",
      reviewStrictness: "strict",
    });
    expect(fragment).not.toContain("strict");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/preference-fragment.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现片段构造**

```ts
// src/main/core/services/preference-fragment.ts
/** 用户写作偏好（跨作品） */
export interface WritingPreference {
  sentenceStyle?: string;
  tone?: string;
  pov?: string;
  pacing?: string;
  vocabulary?: string[];
  taboos?: string[];
  reviewStrictness: "lenient" | "normal" | "strict";
}

/**
 * 把用户写作偏好组织为注入提示的片段。
 * 只含影响写作的字段；reviewStrictness 属审核设定，不在此处。
 * 无可用内容时返回空串，避免注入空噪音。
 */
export function buildPreferenceFragment(
  pref: WritingPreference | undefined,
): string {
  if (!pref) return "";

  const lines: string[] = [];
  if (pref.sentenceStyle) lines.push(`句式：${pref.sentenceStyle}`);
  if (pref.tone) lines.push(`基调：${pref.tone}`);
  if (pref.pov) lines.push(`视角：${pref.pov}`);
  if (pref.pacing) lines.push(`节奏：${pref.pacing}`);
  if (pref.vocabulary?.length) {
    lines.push(`用词偏好：${pref.vocabulary.join("、")}`);
  }
  if (pref.taboos?.length) lines.push(`禁忌：${pref.taboos.join("、")}`);

  if (lines.length === 0) return "";
  return `写作偏好：\n${lines.map((l) => `- ${l}`).join("\n")}`;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/preference-fragment.test.ts`
Expected: PASS（4 个用例）

- [ ] **Step 5: 类型检查与提交**

Run: `pnpm typecheck` —— 通过

```bash
git add src/main/core/services/preference-fragment.ts tests/unit/main/preference-fragment.test.ts
git commit -m "feat: 新增用户写作偏好注入片段"
```

---

### Task 2: 从反馈中提取偏好信号（纯函数）

**Files:**
- Create: `src/main/core/services/preference-signals.ts`
- Test: `tests/unit/main/preference-signals.test.ts`

**Interfaces:**
- Produces: `FeedbackAction`、`PreferenceSuggestion`、`extractPreferenceSignals(action, feedback)`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from "vitest";
import { extractPreferenceSignals } from "@/main/core/services/preference-signals";

describe("extractPreferenceSignals", () => {
  it("确认不产生任何建议（无信号）", () => {
    expect(extractPreferenceSignals("confirm", "写得不错")).toEqual([]);
  });

  it("打回且提及风格时产出对应字段建议", () => {
    const suggestions = extractPreferenceSignals(
      "reject",
      "整体太啰嗦了，句式再简短一些",
    );
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].field).toBe("sentenceStyle");
    expect(suggestions[0].reason).toContain("太啰嗦");
  });

  it("提及禁忌时归到 taboos", () => {
    const suggestions = extractPreferenceSignals("edit", "不要出现暴力描写");
    const taboo = suggestions.find((s) => s.field === "taboos");
    expect(taboo?.value).toContain("暴力");
  });

  it("空反馈不产生建议", () => {
    expect(extractPreferenceSignals("reject", "")).toEqual([]);
    expect(extractPreferenceSignals("edit", "   ")).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/preference-signals.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现信号提取**

```ts
// src/main/core/services/preference-signals.ts
import type { WritingPreference } from "./preference-fragment";

export type FeedbackAction = "confirm" | "edit" | "reject";

export interface PreferenceSuggestion {
  field: keyof WritingPreference;
  value: string;
  /** 触发该建议的反馈原文，供用户判断是否采纳 */
  reason: string;
}

/** 关键词 → 偏好字段（首版规则匹配，后续可换模型判断） */
const KEYWORD_RULES: Array<{
  field: keyof WritingPreference;
  keywords: string[];
  extract: (text: string) => string;
}> = [
  {
    field: "sentenceStyle",
    keywords: ["啰嗦", "冗长", "句式", "简短", "精炼"],
    extract: (text) => text.trim(),
  },
  {
    field: "tone",
    keywords: ["语气", "基调", "太凶", "太平"],
    extract: (text) => text.trim(),
  },
  {
    field: "pacing",
    keywords: ["节奏", "太快", "太慢", "拖沓"],
    extract: (text) => text.trim(),
  },
  {
    field: "taboos",
    keywords: ["不要出现", "禁忌", "别写"],
    extract: (text) => {
      const match = /(?:不要出现|禁忌|别写)(.*)$/.exec(text);
      return (match?.[1] ?? text).replace(/^[：:\s]+/, "").trim();
    },
  },
];

/**
 * 从用户反馈中提取偏好更新建议。
 * 只产出建议，不落库——落库前必须经用户确认（spec §6.3）。
 */
export function extractPreferenceSignals(
  action: FeedbackAction,
  feedback: string,
): PreferenceSuggestion[] {
  if (action === "confirm") return [];
  const text = feedback.trim();
  if (!text) return [];

  const suggestions: PreferenceSuggestion[] = [];
  for (const rule of KEYWORD_RULES) {
    if (!rule.keywords.some((k) => text.includes(k))) continue;
    const value = rule.extract(text);
    if (!value) continue;
    suggestions.push({ field: rule.field, value, reason: text });
  }
  return suggestions;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/preference-signals.test.ts`
Expected: PASS（4 个用例）

- [ ] **Step 5: 类型检查与提交**

Run: `pnpm typecheck` —— 通过

```bash
git add src/main/core/services/preference-signals.ts tests/unit/main/preference-signals.test.ts
git commit -m "feat: 从用户反馈提取写作偏好建议"
```

---

### Task 3: 偏好合并去重与落库服务

**Files:**
- Create: `src/main/core/services/writing-preference.service.ts`
- Test: `tests/unit/main/writing-preference.service.test.ts`

**Interfaces:**
- Produces: `mergePreferences(current, suggestions)`、`writingPreferenceService.read()`、`writingPreferenceService.applySuggestions(suggestions)`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const store: { value: unknown } = { value: undefined };
vi.mock("@/main/core/services/config.service", () => ({
  configService: {
    getValue: (key: string) =>
      key === "writingPreference" ? store.value : undefined,
    setValue: (key: string, value: unknown) => {
      if (key === "writingPreference") store.value = value;
    },
  },
}));

import {
  mergePreferences,
  writingPreferenceService,
} from "@/main/core/services/writing-preference.service";

describe("mergePreferences", () => {
  it("标量字段被建议覆盖", () => {
    const merged = mergePreferences(
      { tone: "温和", reviewStrictness: "normal" },
      [{ field: "tone", value: "冷峻", reason: "太温和" }],
    );
    expect(merged.tone).toBe("冷峻");
  });

  it("数组成员已存在时不重复追加", () => {
    const merged = mergePreferences(
      { taboos: ["暴力"], reviewStrictness: "normal" },
      [{ field: "taboos", value: "暴力", reason: "x" }],
    );
    expect(merged.taboos).toEqual(["暴力"]);
  });

  it("数组成员为新值时追加", () => {
    const merged = mergePreferences(
      { taboos: ["暴力"], reviewStrictness: "normal" },
      [{ field: "taboos", value: "说教", reason: "x" }],
    );
    expect(merged.taboos).toEqual(["暴力", "说教"]);
  });

  it("不修改传入对象（无副作用）", () => {
    const current = { tone: "温和", reviewStrictness: "normal" as const };
    const snapshot = JSON.stringify(current);
    mergePreferences(current, [{ field: "tone", value: "冷峻", reason: "x" }]);
    expect(JSON.stringify(current)).toBe(snapshot);
  });
});

describe("writingPreferenceService", () => {
  beforeEach(() => {
    store.value = undefined;
  });

  it("缺省时回退 normal 严格度与空数组", () => {
    const pref = writingPreferenceService.read();
    expect(pref.reviewStrictness).toBe("normal");
    expect(pref.taboos).toEqual([]);
  });

  it("applySuggestions 落库后 read 能读回", () => {
    writingPreferenceService.applySuggestions([
      { field: "tone", value: "冷峻", reason: "太温和" },
    ]);
    expect(writingPreferenceService.read().tone).toBe("冷峻");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/writing-preference.service.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现合并与服务**

```ts
// src/main/core/services/writing-preference.service.ts
import { configService } from "@/main/core/services/config.service";
import { Logger } from "@/main/utils/logger";
import type { WritingPreference } from "./preference-fragment";
import type { PreferenceSuggestion } from "./preference-signals";

const CONFIG_KEY = "writingPreference";

const DEFAULT_PREFERENCE: WritingPreference = {
  taboos: [],
  vocabulary: [],
  reviewStrictness: "normal",
};

/**
 * 把偏好建议合并进当前偏好。
 * 标量字段覆盖；数组成员去重后追加；reviewStrictness 不由反馈自动改写。
 * 不修改入参。
 */
export function mergePreferences(
  current: WritingPreference,
  suggestions: PreferenceSuggestion[],
): WritingPreference {
  const next: WritingPreference = { ...current };
  if (current.taboos) next.taboos = [...current.taboos];
  if (current.vocabulary) next.vocabulary = [...current.vocabulary];

  for (const s of suggestions) {
    if (s.field === "taboos" || s.field === "vocabulary") {
      const existing = next[s.field] ?? [];
      if (!existing.includes(s.value)) next[s.field] = [...existing, s.value];
      continue;
    }
    if (s.field === "reviewStrictness") continue;
    next[s.field] = s.value;
  }

  return next;
}

/**
 * 用户写作偏好读写。
 * 写入仅经 applySuggestions——调用前必须已获用户确认（spec §6.3）。
 */
class WritingPreferenceService {
  private static instance: WritingPreferenceService | null = null;

  public static getInstance(): WritingPreferenceService {
    if (!WritingPreferenceService.instance) {
      WritingPreferenceService.instance = new WritingPreferenceService();
    }
    return WritingPreferenceService.instance;
  }

  public read(): WritingPreference {
    const raw = configService.getValue<Partial<WritingPreference>>(CONFIG_KEY);
    return {
      ...DEFAULT_PREFERENCE,
      ...(raw ?? {}),
      taboos: raw?.taboos ?? [],
      vocabulary: raw?.vocabulary ?? [],
    };
  }

  /** 应用「已获用户确认」的偏好建议并落库（本方法不做确认） */
  public applySuggestions(
    suggestions: PreferenceSuggestion[],
  ): WritingPreference {
    const next = mergePreferences(this.read(), suggestions);
    configService.setValue(CONFIG_KEY, next);
    Logger.info("[WritingPreferenceService] 偏好已更新", {
      fields: suggestions.map((s) => s.field),
    });
    return next;
  }
}

export const writingPreferenceService = WritingPreferenceService.getInstance();
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/writing-preference.service.test.ts`
Expected: PASS（6 个用例）

> `configService.getValue` 已在代码库多处使用；**写方法名**请在实现时确认一次（本计划按 `setValue` 编写），若不同则同步调整 mock 与调用。

- [ ] **Step 5: 类型检查与提交**

Run: `pnpm typecheck` —— 通过

```bash
git add src/main/core/services/writing-preference.service.ts tests/unit/main/writing-preference.service.test.ts
git commit -m "feat: 新增写作偏好合并去重与落库服务"
```

---

### Task 4: 审核判定标准（审核时）

**Files:**
- Create: `src/main/core/services/review-criteria.ts`
- Test: `tests/unit/main/review-criteria.test.ts`

**Interfaces:**
- Produces: `ReviewWorkStyle`、`buildReviewCriteria(pref, style?)`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from "vitest";
import { buildReviewCriteria } from "@/main/core/services/review-criteria";

describe("buildReviewCriteria", () => {
  it("把禁忌与作品约束列为硬性标准", () => {
    const criteria = buildReviewCriteria(
      { taboos: ["暴力"], reviewStrictness: "normal" },
      { tone: "冷峻", pov: "第一人称", constraints: ["不要出现现代词汇"] },
    );
    expect(criteria).toContain("暴力");
    expect(criteria).toContain("不要出现现代词汇");
  });

  it("严格度映射为明确的判定要求", () => {
    expect(buildReviewCriteria({ reviewStrictness: "strict" })).toContain("偏严");
    expect(buildReviewCriteria({ reviewStrictness: "lenient" })).toContain("放宽");
  });

  it("无禁忌无约束时也给出基调与视角要求", () => {
    const criteria = buildReviewCriteria(
      { reviewStrictness: "normal" },
      { tone: "冷峻", pov: "第一人称" },
    );
    expect(criteria).toContain("冷峻");
    expect(criteria).toContain("第一人称");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/review-criteria.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现标准构造**

```ts
// src/main/core/services/review-criteria.ts
import type { WritingPreference } from "./preference-fragment";

export interface ReviewWorkStyle {
  tone: string;
  pov: string;
  constraints?: string[];
}

const STRICTNESS_TEXT: Record<WritingPreference["reviewStrictness"], string> = {
  strict: "判定尺偏严：宁可交回人工，也不要放过可疑之处。",
  normal: "判定尺适中：仅放行高置信且无硬约束命中的产出。",
  lenient: "判定尺可放宽：轻微瑕疵可放行，但硬约束除外。",
};

/**
 * 构造审核判定标准（供 Reviewer 使用）。
 * 禁忌与作品约束是硬性标准——命中即回退人工，永不自动放行。
 */
export function buildReviewCriteria(
  pref: WritingPreference,
  style?: ReviewWorkStyle,
): string {
  const lines: string[] = [STRICTNESS_TEXT[pref.reviewStrictness]];

  const hard: string[] = [];
  if (pref.taboos?.length) hard.push(...pref.taboos);
  if (style?.constraints?.length) hard.push(...style.constraints);
  if (hard.length > 0) {
    lines.push(`硬性禁忌（命中即交回人工）：${hard.join("、")}`);
  }

  if (style?.tone) lines.push(`基调应符合：${style.tone}`);
  if (style?.pov) lines.push(`叙事视角应保持：${style.pov}`);

  return lines.join("\n");
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/review-criteria.test.ts`
Expected: PASS（3 个用例）

- [ ] **Step 5: 类型检查与提交**

Run: `pnpm typecheck` —— 通过

```bash
git add src/main/core/services/review-criteria.ts tests/unit/main/review-criteria.test.ts
git commit -m "feat: 新增审核判定标准构造"
```

---

## 后续计划（本计划不含）

- P5 审核与委托（§6.1）
- 页面创作 UI 接线（向导 + IPC 四层，§5.2 的交互部分）

**延后项**：模型驱动的信号提取（接口不变，仅换 `extractPreferenceSignals` 实现）、偏好建议的确认 UI、`configService` 写方法名的最终确认。

## 风险与开放问题

| 风险 | 说明 | 缓解 |
|---|---|---|
| 关键词规则过粗 | 首版靠关键词匹配，可能误判 | 只产出**建议**且需用户确认，误判代价低；后续换模型判定 |
| 与 P4 注入重复 | 两处都可能注入偏好 | 已显式分工：P4 管 brief/style，本计划管 user 偏好 |
| 自动改写严格度 | 严格度影响审核宽严，被自动改写会放大风险 | `mergePreferences` 显式跳过 `reviewStrictness` |
| 绕过"先建议后确认" | 直接调用 `applySuggestions` 即可落库 | 方法注释明确调用方必须先经确认门；后续可在 UI 层加校验 |
