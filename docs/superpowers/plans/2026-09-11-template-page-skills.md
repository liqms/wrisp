# 模板页面级技能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让页面模板可以声明"页面级技能"（引用技能 id + 参数 + 是否需确认），使不同模板具备不同的页面创作动态逻辑；本计划只负责**声明、加载、透传与解析**，实际执行由 P4 页面创作计划接入。

**Architecture:** 页面模板新增可选字段 `skills: TemplatePageSkill[]`。因为 `resources/schemas/template.schema.json` 顶部是 `additionalProperties: false`，**不改 schema 会被直接拒收**；同时内置模板加载器是**显式挑字段**的（`getBuiltInTemplates` 逐字段构造），所以还要在加载与合并链路上逐处透传，否则字段会被静默吞掉。加载解析抽成纯函数 `parseTemplateResource` 以便单测；pipeline 解析抽成纯函数 `resolvePagePipeline`。

**Tech Stack:** TypeScript（strict）、Electron main、Ajv（schema 校验）、Vue/Pinia（renderer 侧 merge）、Vitest。

**Spec:** `docs/superpowers/specs/2026-09-10-creation-agent-design.md`（§4.2 三级作用域之"页面（模板级）"、§6.5 模板驱动 pipeline、§7 I5）

## Global Constraints

- Node.js 24+，包管理用 pnpm。
- TypeScript 严格模式：`noUnusedLocals` 与 `noUnusedParameters` 严格。
- 测试用 Vitest，`globals: true`、`environment: happy-dom`；放 `tests/unit/**`。
- 模板 schema 顶部为 `additionalProperties: false`——新增字段**必须**同时改 schema，否则校验直接失败、模板被跳过。
- 内置模板 `profession` 不含 `custom`；非法 icon 回退 `DEFAULT_TEMPLATE_ICON`。这两个既有行为**不得回归**。
- **模板只引用技能 id，不新增技能加载路径**（方案 A：模板做编排、技能本体在全局/作品）。
- 单测环境无 Electron 运行时；导入链触及 `app` 时用 `vi.mock("electron", …)` 切断。

---

### Task 1: `TemplatePageSkill` 类型与 schema 放行

**Files:**
- Modify: `src/shared/types/template.types.ts`
- Modify: `resources/schemas/template.schema.json`
- Test: `tests/unit/shared/template-page-skill.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `interface TemplatePageSkill { id: string; skillId: string; params?: Record<string, unknown>; requiresConfirm?: boolean }`
  - `TemplateResourceFile.skills?: TemplatePageSkill[]`
  - `CustomTemplate.skills?: TemplatePageSkill[]`
  - `TemplateItem.skills?: TemplatePageSkill[]`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from "vitest";
import type { TemplateResourceFile } from "@/shared/types/template.types";

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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vue-tsc --noEmit -p tsconfig.vitest.json`
Expected: FAIL —— `skills` 不存在于 `TemplateResourceFile`

- [ ] **Step 3: 加类型与 schema 字段**

在 `src/shared/types/template.types.ts` 中，`LocalizedText` 之后新增：

```ts
/**
 * 页面模板声明的页面级技能（方案 A：模板做编排、技能本体在全局/作品）。
 * id 为模板内步骤标识；skillId 引用技能 id（解析顺序：作品 → 全局）。
 */
export interface TemplatePageSkill {
  id: string;
  skillId: string;
  params?: Record<string, unknown>;
  /** 该步骤产出是否需用户确认；缺省视为需要确认（保守） */
  requiresConfirm?: boolean;
}
```

给三个接口各加一行可选字段：

```ts
  /** 页面级技能（仅 page 模板使用；slash 模板留空） */
  skills?: TemplatePageSkill[];
```

分别加在 `CustomTemplate`、`TemplateResourceFile`、`TemplateItem` 的字段列表中（`TemplateItem` 上加在 `enabled` 之前）。

在 `resources/schemas/template.schema.json` 的 `properties` 中新增（与 `"enabled"` 同级）：

```json
    "skills": {
      "type": "array",
      "description": "页面级技能声明（仅 page 模板使用）",
      "items": {
        "type": "object",
        "required": ["id", "skillId"],
        "additionalProperties": false,
        "properties": {
          "id": { "type": "string", "minLength": 1, "maxLength": 64 },
          "skillId": { "type": "string", "minLength": 1, "maxLength": 64 },
          "params": { "type": "object" },
          "requiresConfirm": { "type": "boolean" }
        }
      }
    }
```

> 注意：`required` 数组**不要**加入 `skills`——它是可选字段（现有 slash 模板与历史自定义模板都没有它）。

- [ ] **Step 4: 运行类型检查确认通过**

Run: `npx vue-tsc --noEmit -p tsconfig.vitest.json`
Expected: 该测试文件无报错

- [ ] **Step 5: 校验 schema 本身合法**

Run: `node -e "JSON.parse(require('fs').readFileSync('resources/schemas/template.schema.json','utf8')); console.log('schema JSON OK')"`
Expected: 输出 `schema JSON OK`

- [ ] **Step 6: 提交**

```bash
git add src/shared/types/template.types.ts resources/schemas/template.schema.json tests/unit/shared/template-page-skill.test.ts
git commit -m "feat: 页面模板支持声明页面级技能（类型与 schema）"
```

---

### Task 2: 抽出纯函数 `parseTemplateResource` 并解析 `skills`

**Files:**
- Create: `src/main/core/services/template-resource.parser.ts`
- Modify: `src/main/core/services/template.service.ts`（`getBuiltInTemplates` 改用该纯函数）
- Test: `tests/unit/main/template-resource.parser.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `TemplatePageSkill`、`TemplateResourceFile`
- Produces: `parseTemplateResource(raw: Partial<TemplateResourceFile>): TemplateResourceFile | null`

- [ ] **Step 1: 写失败测试**

```ts
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
    const parsed = parseTemplateResource({ id: "t" });
    expect(parsed?.skills).toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/template-resource.parser.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 抽出纯函数**

```ts
// src/main/core/services/template-resource.parser.ts
import {
  DEFAULT_TEMPLATE_ICON,
  isTemplateIconName,
} from "@/shared/enums/template.enums";
import { PROFESSION } from "@/shared/enums";
import type { Profession } from "@/shared/enums/profession.enums";
import type {
  TemplatePageSkill,
  TemplateResourceFile,
} from "@/shared/types/template.types";

/**
 * 把内置模板 JSON 的原始对象规范化为 TemplateResourceFile。
 * 纯函数：不读文件、不碰 Electron，便于单测。
 * 既有行为保持不变：profession 过滤 custom、非法 icon 回退默认值。
 */
export function parseTemplateResource(
  raw: Partial<TemplateResourceFile>,
): TemplateResourceFile | null {
  if (!raw.id || typeof raw.id !== "string") return null;

  const skills = normalizeSkills(raw.skills);

  return {
    id: raw.id,
    version: typeof raw.version === "string" ? raw.version : "0.0.0",
    title: raw.title ?? { zh: raw.id, en: raw.id },
    description: raw.description ?? { zh: "", en: "" },
    icon: isTemplateIconName(raw.icon) ? raw.icon : DEFAULT_TEMPLATE_ICON,
    markdown: raw.markdown ?? { zh: "", en: "" },
    profession: Array.isArray(raw.profession)
      ? raw.profession.filter(
          (p): p is Profession =>
            typeof p === "string" && p !== PROFESSION.CUSTOM,
        )
      : [PROFESSION.GENERAL],
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    enabled: raw.enabled !== false,
    ...(skills ? { skills } : {}),
  };
}

/** 规范化页面级技能声明；无有效条目时返回 undefined（不注入空数组） */
function normalizeSkills(raw: unknown): TemplatePageSkill[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items: TemplatePageSkill[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Partial<TemplatePageSkill>;
    if (typeof e.id !== "string" || typeof e.skillId !== "string") continue;
    items.push({
      id: e.id,
      skillId: e.skillId,
      ...(e.params ? { params: e.params } : {}),
      ...(e.requiresConfirm !== undefined
        ? { requiresConfirm: e.requiresConfirm }
        : {}),
    });
  }
  return items.length > 0 ? items : undefined;
}
```

在 `src/main/core/services/template.service.ts` 的 `getBuiltInTemplates` 中，把"逐字段构造 `tpl`"的那段替换为调用纯函数：

```ts
        const parsedRaw = JSON.parse(
          fs.readFileSync(path.join(resourcesDir, file), "utf-8"),
        ) as Partial<TemplateResourceFile>;
        const tpl = parseTemplateResource(parsedRaw);
        if (!tpl) continue;
```

并在文件顶部引入：

```ts
import { parseTemplateResource } from "./template-resource.parser";
```

> 替换后 `tpl` 的后续 schema 校验与 `result.push(tpl)` 保持不变。原实现里对 `icon`/`profession`/`title` 等的规范化已全部搬进纯函数，**行为必须一致**（Step 1 的第 3 个用例就是防回归）。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/template-resource.parser.test.ts`
Expected: PASS（4 个用例）

- [ ] **Step 5: 回归既有模板测试**

Run: `pnpm test tests/unit/main/template.api.test.ts tests/unit/main/template-installed.service.test.ts tests/unit/renderer/slash-templates.test.ts`
Expected: 与改动前一致的通过/失败状态（`template-installed.service` 在基线上即为失败，见素材检索计划的基线对比）

- [ ] **Step 6: 类型检查与提交**

Run: `pnpm typecheck` —— 通过

```bash
git add src/main/core/services/template-resource.parser.ts src/main/core/services/template.service.ts tests/unit/main/template-resource.parser.test.ts
git commit -m "refactor: 抽出模板资源解析纯函数并透传页面级技能"
```

---

### Task 3: `mergeTemplates` 透传 `skills`

**Files:**
- Modify: `src/renderer/components/editor/slash/commands/template-merge.ts`
- Test: `tests/unit/renderer/template-merge.test.ts`（追加用例）

- [ ] **Step 1: 追加失败测试**

在既有 `tests/unit/renderer/template-merge.test.ts` 中追加：

```ts
  it("把内置模板的 skills 透传到 TemplateItem", () => {
    const items = mergeTemplates(
      [
        {
          id: "page-prd",
          version: "1.0.0",
          title: { zh: "PRD", en: "PRD" },
          description: { zh: "", en: "" },
          icon: "fact_check",
          markdown: { zh: "", en: "" },
          profession: ["pm"],
          tags: [],
          enabled: true,
          skills: [{ id: "s1", skillId: "outline", requiresConfirm: true }],
        },
      ],
      null,
      "zhCN",
    );
    expect(items[0].skills).toEqual([
      { id: "s1", skillId: "outline", requiresConfirm: true },
    ]);
  });
```

> 沿用该文件既有的 import 与 `mergeTemplates` 引用方式；若原文件用的是具名/默认导入，按原样书写。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/renderer/template-merge.test.ts`
Expected: 新用例 FAIL（`items[0].skills` 为 undefined）

- [ ] **Step 3: 在合并中透传**

`src/renderer/components/editor/slash/commands/template-merge.ts` 的 `builtinItems` 映射中，在 `enabled` 之前加：

```ts
    skills: def.skills,
```

`customItems` 映射中加：

```ts
      skills: c.skills,
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/renderer/template-merge.test.ts`
Expected: 全部用例 PASS

- [ ] **Step 5: 类型检查与提交**

Run: `pnpm typecheck` —— 通过

```bash
git add src/renderer/components/editor/slash/commands/template-merge.ts tests/unit/renderer/template-merge.test.ts
git commit -m "feat: 模板合并透传页面级技能声明"
```

---

### Task 4: 页面 pipeline 解析（纯函数）

**Files:**
- Create: `src/main/core/skills/page-pipeline.ts`
- Test: `tests/unit/main/page-pipeline.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `TemplatePageSkill`
- Produces:
  - `interface PagePipelineStep { stepId: string; skillId: string; params: Record<string, unknown>; requiresConfirm: boolean }`
  - `resolvePagePipeline(skills: TemplatePageSkill[] | undefined, context: Record<string, unknown>): PagePipelineStep[]`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from "vitest";
import { resolvePagePipeline } from "@/main/core/skills/page-pipeline";

describe("resolvePagePipeline", () => {
  it("无声明时返回空流水线", () => {
    expect(resolvePagePipeline(undefined, {})).toEqual([]);
    expect(resolvePagePipeline([], {})).toEqual([]);
  });

  it("requiresConfirm 缺省视为 true（保守）", () => {
    const steps = resolvePagePipeline([{ id: "s1", skillId: "outline" }], {});
    expect(steps[0].requiresConfirm).toBe(true);
  });

  it("显式 false 时不再要求确认", () => {
    const steps = resolvePagePipeline(
      [{ id: "s1", skillId: "outline", requiresConfirm: false }],
      {},
    );
    expect(steps[0].requiresConfirm).toBe(false);
  });

  it("运行时上下文覆盖模板参数", () => {
    const steps = resolvePagePipeline(
      [{ id: "s1", skillId: "outline", params: { text: "模板值", tone: "正式" } }],
      { text: "运行时值" },
    );
    expect(steps[0].params).toEqual({ text: "运行时值", tone: "正式" });
  });

  it("保持声明顺序", () => {
    const steps = resolvePagePipeline(
      [
        { id: "a", skillId: "one" },
        { id: "b", skillId: "two" },
      ],
      {},
    );
    expect(steps.map((s) => s.stepId)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/page-pipeline.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现解析**

```ts
// src/main/core/skills/page-pipeline.ts
import type { TemplatePageSkill } from "@/shared/types/template.types";

export interface PagePipelineStep {
  stepId: string;
  skillId: string;
  params: Record<string, unknown>;
  requiresConfirm: boolean;
}

/**
 * 把页面模板声明的页面级技能解析为可执行步骤序列。
 * 参数合并：模板 params 为基础，运行时 context 覆盖同名键。
 * requiresConfirm 缺省为 true——保守起见，未显式声明即要求用户确认。
 */
export function resolvePagePipeline(
  skills: TemplatePageSkill[] | undefined,
  context: Record<string, unknown>,
): PagePipelineStep[] {
  if (!skills || skills.length === 0) return [];
  return skills.map((s) => ({
    stepId: s.id,
    skillId: s.skillId,
    params: { ...(s.params ?? {}), ...context },
    requiresConfirm: s.requiresConfirm !== false,
  }));
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/page-pipeline.test.ts`
Expected: PASS（5 个用例）

- [ ] **Step 5: 类型检查与提交**

Run: `pnpm typecheck` —— 通过

```bash
git add src/main/core/skills/page-pipeline.ts tests/unit/main/page-pipeline.test.ts
git commit -m "feat: 新增页面流水线解析（模板驱动）"
```

---

## 依赖关系

本计划**只做声明、加载、透传与解析**，不执行技能。执行需要：

- `skillManager.resolveSkillDefinition(skillId, projectId?)` —— 来自 **技能作品作用域** 计划
- `skillExecutor.execute(skillId, inputs, projectId?)` —— 同上
- 确认门 `decideGateOutcome` 与 `CreationSessionService` —— 来自 **创作会话与确认门** 计划

因此建议执行顺序：技能作品作用域 → 创作会话与确认门 → 本计划 → P4。

## 后续计划（本计划不含）

| 计划 | 覆盖 spec 条目 |
|---|---|
| P1 作品采集向导 + P2 作品技能派生 | §5.1、§6.2 |
| P4 页面大纲与分步创作 | §5.2、§6.6 |
| P3 偏好与风格记忆 | §6.3 |
| P5 审核与委托 | §6.1 |

## 风险与开放问题

| 风险 | 说明 | 缓解 |
|---|---|---|
| **schema 拒收** | `template.schema.json` 顶部 `additionalProperties: false`，漏改 schema 会让带 `skills` 的模板被整份跳过 | T1 显式改 schema，并用 `node` 校验 JSON 合法性 |
| **加载器吞字段** | `getBuiltInTemplates` 是显式挑字段构造，不解析 `skills` 就会静默丢失 | T2 抽纯函数并显式透传，加"保留 skills"用例 |
| **行为回归** | 抽函数会把 icon/profession 规范化搬走 | T2 加防回归用例（custom 过滤 + 非法 icon 回退） |
| **渲染层漏传** | `mergeTemplates` 决定前文能否看到 skills | T3 加透传用例 |
| 单测无 Electron 运行时 | `template.service.ts` 导入 `electron`、`configService` 等 | 本计划把解析逻辑抽成**纯函数**，测试只导纯函数，不导 service |
| 自定义模板 UI 尚未支持编辑 skills | 本计划只打通数据链路 | 编辑 UI 随 P1/P4 接入 |
