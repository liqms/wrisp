# 页面大纲与分步创作 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通"按模板新建页面 → 采集内容概述 → 可选生成大纲（并过目素材）→ 逐节创作、每节过确认门"这条页面级链路。

**Architecture:** 分两层：**纯函数层**（上下文装配、大纲解析、素材预取、确认门上下文构造）便于单测；**接线层**（IPC 四层 + 向导 UI）由后续 UI 计划完成。素材遵循方案 C——**大纲阶段让用户过目**（可剔除），**逐节创作直接注入**不打断。确认门判定复用 `decideGateOutcome`。

**Tech Stack:** TypeScript（strict）、Electron main、Vitest。

**Spec:** `docs/superpowers/specs/2026-09-10-creation-agent-design.md`（§5.2 页面级主流程、§6.5 模板驱动 pipeline、§6.6 素材检索、§4.3 OutlineNode）

## Global Constraints

- Node.js 24+，包管理用 pnpm。
- TypeScript 严格模式：`noUnusedLocals` 与 `noUnusedParameters` 严格。
- 测试用 Vitest，`globals: true`、`environment: happy-dom`；放 `tests/unit/**`。
- **素材检索必须带 `projectId`**，任何情况下不得跨作品召回。
- **每节创作后必须过确认门**；`requiresConfirm` 缺省为 true（保守）。
- 素材过目只发生在**大纲阶段**；逐节创作直接注入，不打断（方案 C）。
- 单测环境无 Electron 运行时；导入链触及 `app` 时用 `vi.mock("electron", …)` 切断。

## 前置依赖（必须先完成）

| 计划 | 本计划用到的产出 |
|---|---|
| 按作品素材检索 | `materialSearchService.search({ projectId, query, kinds, limit })` |
| 技能作品作用域 | `skillManager.resolveSkillDefinition`、`skillExecutor.execute(..., projectId?)` |
| 创作会话与确认门 | `creationSessionService.*`、`decideGateOutcome(ctx)` |
| 模板页面级技能 | `resolvePagePipeline(skills, context)` |
| 作品采集与技能派生 | `workProfileStore.read(projectFilePath)` |

---

### Task 1: 大纲类型与页面创作上下文装配（纯函数）

**Files:**
- Create: `src/shared/types/outline.types.ts`
- Modify: `src/shared/types/index.ts`
- Create: `src/main/core/services/page-write-context.ts`
- Test: `tests/unit/main/page-write-context.test.ts`

**Interfaces:**
- Consumes: `WorkBrief` / `WorkStyle`（作品采集计划）
- Produces: `OutlineNode`、`ParsedOutline`、`buildPageWriteInputs(input): Record<string, unknown>`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from "vitest";
import { buildPageWriteInputs } from "@/main/core/services/page-write-context";

describe("buildPageWriteInputs", () => {
  it("把作品信息、页面概述与模板骨架装配为技能输入", () => {
    const inputs = buildPageWriteInputs({
      brief: { name: "长夜", type: "novel", audience: "青年读者", tone: "克制" },
      style: { tone: "冷峻", pov: "第一人称" },
      pageTitle: "第一章",
      overview: "主角初到边城",
      templateSkeleton: "# 第一章",
    });
    expect(inputs.audience).toBe("青年读者");
    expect(inputs.tone).toBe("冷峻");
    expect(inputs.overview).toBe("主角初到边城");
    expect(inputs.workName).toBe("长夜");
  });

  it("缺失字段不注入空串", () => {
    const inputs = buildPageWriteInputs({
      brief: { name: "x", type: "novel" },
      pageTitle: "t",
      overview: "o",
    });
    expect("audience" in inputs).toBe(false);
    expect("tone" in inputs).toBe(false);
  });

  it("作品风格优先于简报中的同名字段", () => {
    const inputs = buildPageWriteInputs({
      brief: { name: "x", type: "novel", tone: "温和" },
      style: { tone: "冷峻", pov: "第三人称" },
      pageTitle: "t",
      overview: "o",
    });
    expect(inputs.tone).toBe("冷峻");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/page-write-context.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 新增类型与装配函数**

```ts
// src/shared/types/outline.types.ts
/** 大纲节点（页面级） */
export interface OutlineNode {
  id: string;
  title: string;
  summary: string;
  status: "pending" | "confirmed" | "written";
  children?: OutlineNode[];
}

/** 大纲解析结果 */
export interface ParsedOutline {
  nodes: OutlineNode[];
}
```

在 `src/shared/types/index.ts` 追加：

```ts
export * from "./outline.types";
```

```ts
// src/main/core/services/page-write-context.ts
import type { WorkBrief, WorkStyle } from "@/shared/types";

export interface PageWriteContextInput {
  brief: WorkBrief;
  style?: WorkStyle;
  pageTitle: string;
  overview: string;
  templateSkeleton?: string;
}

/**
 * 装配技能输入。
 * 作品风格（更具体）优先于作品简报中的同名字段；缺失字段不注入空串。
 */
export function buildPageWriteInputs(
  input: PageWriteContextInput,
): Record<string, unknown> {
  const { brief, style, pageTitle, overview, templateSkeleton } = input;
  const result: Record<string, unknown> = {
    workName: brief.name,
    workType: brief.type,
    pageTitle,
    overview,
  };

  const tone = style?.tone ?? brief.tone;
  if (tone) result.tone = tone;
  const pov = style?.pov ?? brief.pov;
  if (pov) result.pov = pov;
  if (brief.audience) result.audience = brief.audience;
  if (brief.lengthTarget) result.lengthTarget = brief.lengthTarget;
  if (brief.themes?.length) result.themes = brief.themes.join("、");
  if (brief.taboos?.length) result.taboos = brief.taboos.join("、");
  if (style?.constraints?.length) {
    result.constraints = style.constraints.join("、");
  }
  if (templateSkeleton) result.templateSkeleton = templateSkeleton;

  return result;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/page-write-context.test.ts`
Expected: PASS（3 个用例）

- [ ] **Step 5: 类型检查与提交**

Run: `pnpm typecheck` —— 通过

```bash
git add src/shared/types/outline.types.ts src/shared/types/index.ts src/main/core/services/page-write-context.ts tests/unit/main/page-write-context.test.ts
git commit -m "feat: 新增大纲类型与页面创作上下文装配"
```

---

### Task 2: 大纲解析（纯函数）

**Files:**
- Create: `src/main/core/services/outline.parser.ts`
- Test: `tests/unit/main/outline.parser.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `OutlineNode`
- Produces: `parseOutline(markdown: string): OutlineNode[]`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from "vitest";
import { parseOutline } from "@/main/core/services/outline.parser";

describe("parseOutline", () => {
  it("按 Markdown 列表解析为节点，状态初始为 pending", () => {
    const nodes = parseOutline("- 初到边城\n- 遇见旧友\n- 夜谈");
    expect(nodes.map((n) => n.title)).toEqual(["初到边城", "遇见旧友", "夜谈"]);
    expect(nodes.every((n) => n.status === "pending")).toBe(true);
  });

  it("支持 '标题：摘要' 形式，摘要单独取出", () => {
    const nodes = parseOutline("- 初到边城：主角抵达边城，见到旧识");
    expect(nodes[0].title).toBe("初到边城");
    expect(nodes[0].summary).toBe("主角抵达边城，见到旧识");
  });

  it("摘要缺省为空串", () => {
    expect(parseOutline("- 只有标题")[0].summary).toBe("");
  });

  it("忽略空行与非列表行", () => {
    expect(parseOutline("以下是提纲：\n\n- 甲\n\n- 乙\n")).toHaveLength(2);
  });

  it("为每个节点生成唯一 id", () => {
    const nodes = parseOutline("- 甲\n- 乙");
    expect(nodes[0].id).not.toBe(nodes[1].id);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/outline.parser.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现解析**

```ts
// src/main/core/services/outline.parser.ts
import type { OutlineNode } from "@/shared/types";

const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;

/**
 * 把模型产出的大纲文本解析为节点数组。
 * 只认列表项；'标题：摘要' 形式会拆出摘要；无法解析时返回空数组。
 */
export function parseOutline(markdown: string): OutlineNode[] {
  const nodes: OutlineNode[] = [];

  for (const line of markdown.split(/\r?\n/)) {
    const match = LIST_ITEM.exec(line);
    if (!match) continue;
    const body = match[1].trim();
    if (!body) continue;

    const sepIndex = body.search(/[:：]/);
    const title = sepIndex >= 0 ? body.slice(0, sepIndex).trim() : body;
    const summary = sepIndex >= 0 ? body.slice(sepIndex + 1).trim() : "";
    if (!title) continue;

    nodes.push({
      id: `on_${nodes.length + 1}_${Date.now().toString(36)}`,
      title,
      summary,
      status: "pending",
    });
  }

  return nodes;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/outline.parser.test.ts`
Expected: PASS（5 个用例）

- [ ] **Step 5: 类型检查与提交**

Run: `pnpm typecheck` —— 通过

```bash
git add src/main/core/services/outline.parser.ts tests/unit/main/outline.parser.test.ts
git commit -m "feat: 新增大纲解析"
```

---

### Task 3: 大纲阶段素材预取（方案 C）

**Files:**
- Create: `src/main/core/services/outline-material.prefetch.ts`
- Test: `tests/unit/main/outline-material.prefetch.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `OutlineNode`
- Produces: `MaterialSearchFn`、`NodeMaterials`、`prefetchOutlineMaterials(projectId, nodes, search, limitPerNode?)`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, vi } from "vitest";
import { prefetchOutlineMaterials } from "@/main/core/services/outline-material.prefetch";

const node = (id: string, title: string, summary = "") => ({
  id,
  title,
  summary,
  status: "pending" as const,
});

describe("prefetchOutlineMaterials", () => {
  it("为每个节点检索素材，且强制带 projectId", async () => {
    const search = vi.fn(async () => [
      { kind: "chunk" as const, id: "c1", content: "素材" },
    ]);
    const result = await prefetchOutlineMaterials(
      "p1",
      [node("n1", "初到边城", "抵达边城")],
      search,
    );
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1" }),
    );
    expect(result[0].nodeId).toBe("n1");
    expect(result[0].items).toHaveLength(1);
  });

  it("空大纲不触发检索", async () => {
    const search = vi.fn(async () => []);
    const result = await prefetchOutlineMaterials("p1", [], search);
    expect(result).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });

  it("单节点检索失败不影响其它节点", async () => {
    const search = vi.fn(async ({ query }: { query: string }) => {
      if (query.includes("坏")) throw new Error("boom");
      return [{ kind: "chunk" as const, id: "c1", content: "ok" }];
    });
    const result = await prefetchOutlineMaterials(
      "p1",
      [node("n1", "坏节点"), node("n2", "好节点")],
      search,
    );
    expect(result[0].items).toEqual([]);
    expect(result[1].items).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/outline-material.prefetch.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现预取**

```ts
// src/main/core/services/outline-material.prefetch.ts
import { Logger } from "@/main/utils/logger";
import type { OutlineNode } from "@/shared/types";

export interface MaterialSearchItem {
  kind: "chunk" | "concept" | "topic";
  id: string;
  title?: string;
  content: string;
  score?: number;
}

export type MaterialSearchFn = (params: {
  projectId: string;
  query: string;
  kinds?: string[];
  limit?: number;
}) => Promise<MaterialSearchItem[]>;

export interface NodeMaterials {
  nodeId: string;
  items: MaterialSearchItem[];
}

const DEFAULT_LIMIT_PER_NODE = 5;

/**
 * 大纲阶段素材预取：为每个大纲节点检索本作品素材，供用户过目（方案 C）。
 * 单节点失败不影响其它节点；检索一律限定在 projectId 内。
 */
export async function prefetchOutlineMaterials(
  projectId: string,
  nodes: OutlineNode[],
  search: MaterialSearchFn,
  limitPerNode: number = DEFAULT_LIMIT_PER_NODE,
): Promise<NodeMaterials[]> {
  const result: NodeMaterials[] = [];

  for (const node of nodes) {
    const query = [node.title, node.summary].filter(Boolean).join(" ");
    if (!query.trim()) {
      result.push({ nodeId: node.id, items: [] });
      continue;
    }
    try {
      const items = await search({ projectId, query, limit: limitPerNode });
      result.push({ nodeId: node.id, items });
    } catch (error) {
      Logger.warn("[OutlineMaterialPrefetch] 节点素材检索失败，已跳过", {
        nodeId: node.id,
        error: String(error),
      });
      result.push({ nodeId: node.id, items: [] });
    }
  }

  return result;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/outline-material.prefetch.test.ts`
Expected: PASS（3 个用例）

- [ ] **Step 5: 类型检查与提交**

Run: `pnpm typecheck` —— 通过

```bash
git add src/main/core/services/outline-material.prefetch.ts tests/unit/main/outline-material.prefetch.test.ts
git commit -m "feat: 大纲阶段素材预取（按作品隔离）"
```

---

### Task 4: 页面创作编排决策（含确认门上下文）

**Files:**
- Create: `src/main/core/services/page-creation.service.ts`
- Test: `tests/unit/main/page-creation.service.test.ts`

**Interfaces:**
- Consumes: Task 1–3；确认门计划的 `ReviewStrictness`
- Produces: `pageCreationService.shouldGenerateOutline(needsOutline)`、`pageCreationService.buildGateContext(session, kind, reviewer, reviewStrictness)`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from "vitest";
import { pageCreationService } from "@/main/core/services/page-creation.service";

describe("pageCreationService", () => {
  it("用户选择不生成大纲时跳过大纲阶段", () => {
    expect(pageCreationService.shouldGenerateOutline(false)).toBe(false);
    expect(pageCreationService.shouldGenerateOutline(true)).toBe(true);
  });

  it("构造确认门上下文：逐项委托 + 严格度 + Reviewer 判定", () => {
    const ctx = pageCreationService.buildGateContext(
      { delegation: { section: true } },
      "section",
      { confidence: 0.9, hitHardConstraint: false, calibrated: true },
      "normal",
    );
    expect(ctx.delegated).toBe(true);
    expect(ctx.kind).toBe("section");
    expect(ctx.confidence).toBe(0.9);
  });

  it("未开启该步骤委托时 delegated 为 false", () => {
    const ctx = pageCreationService.buildGateContext(
      { delegation: {} },
      "outline",
      { confidence: 0.99, hitHardConstraint: false, calibrated: true },
      "lenient",
    );
    expect(ctx.delegated).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/page-creation.service.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现编排决策**

```ts
// src/main/core/services/page-creation.service.ts
import type { GateKind } from "@/shared/types";
import type { ReviewStrictness } from "@/main/core/skills/gate-policy";

/** Reviewer 对某次产出的判定输入 */
export interface ReviewerSignal {
  confidence: number;
  hitHardConstraint: boolean;
  calibrated: boolean;
}

export interface DelegationCarrier {
  delegation: Partial<Record<GateKind, boolean>>;
}

export interface PageGateContext {
  kind: GateKind;
  delegated: boolean;
  reviewStrictness: ReviewStrictness;
  hitHardConstraint: boolean;
  confidence: number;
  calibrated: boolean;
}

/**
 * 页面创作编排的纯决策部分。
 * 实际执行（调技能、开关确认门、写回页面）由渲染层经 IPC 驱动；
 * 本服务只负责"该不该生成大纲"与"确认门上下文如何构造"这类可单测的判定。
 */
class PageCreationService {
  private static instance: PageCreationService | null = null;

  public static getInstance(): PageCreationService {
    if (!PageCreationService.instance) {
      PageCreationService.instance = new PageCreationService();
    }
    return PageCreationService.instance;
  }

  /** 用户是否选择了自动生成大纲 */
  public shouldGenerateOutline(needsOutline: boolean): boolean {
    return needsOutline === true;
  }

  /** 构造确认门上下文，交给 decideGateOutcome 判定 */
  public buildGateContext(
    session: DelegationCarrier,
    kind: GateKind,
    reviewer: ReviewerSignal,
    reviewStrictness: ReviewStrictness,
  ): PageGateContext {
    return {
      kind,
      delegated: session.delegation[kind] === true,
      reviewStrictness,
      hitHardConstraint: reviewer.hitHardConstraint,
      confidence: reviewer.confidence,
      calibrated: reviewer.calibrated,
    };
  }
}

export const pageCreationService = PageCreationService.getInstance();
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/page-creation.service.test.ts`
Expected: PASS（3 个用例）

- [ ] **Step 5: 类型检查与提交**

Run: `pnpm typecheck` —— 通过

```bash
git add src/main/core/services/page-creation.service.ts tests/unit/main/page-creation.service.test.ts
git commit -m "feat: 新增页面创作编排决策（大纲开关与确认门上下文）"
```

---

## 为什么编排层只做"决策"

页面链路的**执行**（调 `skillExecutor`、开确认门、把内容写回页面）需要渲染层参与——用户要点"生成"、过大纲确认、逐节确认。把它塞进主进程服务会让本计划无法单测，也会与 UI 计划耦合。因此本计划交付**可执行决策内核**：上下文装配、大纲解析、素材预取、确认门上下文构造；接线（IPC 四层 + 向导 UI）留给紧随其后的 UI 计划，届时直接调用这些函数。

## 后续计划（本计划不含）

| 计划 | 覆盖 spec 条目 |
|---|---|
| P3 偏好与风格记忆 | §6.3 |
| P5 审核与委托 | §6.1 |
| 页面创作 UI 接线（向导 + IPC 四层） | §5.2 的交互部分 |

## 风险与开放问题

| 风险 | 说明 | 缓解 |
|---|---|---|
| 大纲解析过于简陋 | 只认 Markdown 列表与 `标题：摘要` | 5 个用例覆盖；模型输出格式若变化需同步调整正则 |
| 素材预取开销 | 每个大纲节点一次检索 | `limitPerNode` 可调（默认 5）；后续可加并发上限 |
| 跨作品泄漏 | 预取必须带 `projectId` | T3 首条用例即断言 `projectId` 被传入；底层已由素材检索计划强制 |
| 编排仅决策、无端到端集成 | 本计划不含 IPC 与 UI | 见"为什么编排层只做决策"；接线由 UI 计划补齐 |
| 单测依赖上游计划 | 引用 `ReviewStrictness` 等上游**类型** | T4 只类型导入，不 import 上游实现；上游未完成也可编译 |
