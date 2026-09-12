# 作品采集向导与作品技能派生 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建作品时用交互问答采集《作品简报》，并在作品创建完成后**自动**（无确认门）从全局技能派生出一份作品专属技能。

**Architecture:** 作品简报与作品风格写入作品文件夹下的独立文件 `<作品文件夹>/work-profile.json`（`WorkBrief` + `WorkStyle`）。作品技能是全局技能的**派生副本**，通过"技能作品作用域"计划引入的 `projectSkillStore` 落盘，并携带 `sourceTemplateId` / `sourceTemplateVersion` 以便日后提示"有更新可用"。采集问题清单与派生逻辑均实现为**纯函数**，便于单测。

**Tech Stack:** TypeScript（strict）、Electron main、`ProjectDao`（better-sqlite3）、Vitest。

**Spec:** `docs/superpowers/specs/2026-09-10-creation-agent-design.md`（§5.1 作品级主流程、§6.2 技能派生与模板同步、§4.5 存储落点）

## Global Constraints

- Node.js 24+，包管理用 pnpm。
- TypeScript 严格模式：`noUnusedLocals` 与 `noUnusedParameters` 严格。
- 测试用 Vitest，`globals: true`、`environment: happy-dom`；放 `tests/unit/**`。
- **作品技能生成无确认门**：它是"完成新建作品"的同步副作用（spec §5.1）。
- 作品技能必须过 `skillSchemaValidator`，与全局技能同一套校验，不得绕过。
- 单测环境无 Electron 运行时；导入链触及 `app` 时用 `vi.mock("electron", …)` 切断。
- 依赖前置计划：**技能作品作用域**（提供 `projectSkillStore`、`SkillDefinition.sourceTemplateId`）。执行本计划前应先完成它。

## 与 spec 的一处偏差（已裁定）

spec §4.5 写的是"`WorkBrief` / `WorkStyle` → 作品文件夹 `project.json`（现有双存储）"。**实测不可行**：`src/main/core/services/project.service.ts` 的 `syncProjectJson()` 会用数据库记录整份覆盖该文件：

```ts
fileService.writeFile(jsonPath, JSON.stringify(project, null, 2));
```

任何额外写入 `project.json` 的字段都会在下一次同步时被清掉。**裁定**：改用作品文件夹下的独立文件 `work-profile.json`，与 `project.json` 互不干扰；代价是与 spec 文字的存储落点不一致（已在风险表登记）。

---

### Task 1: 作品简报/风格类型与 `workProfileStore`

**Files:**
- Create: `src/shared/types/work-profile.types.ts`
- Modify: `src/shared/types/index.ts`
- Create: `src/main/core/services/work-profile.store.ts`
- Test: `tests/unit/main/work-profile.store.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { workProfileStore } from "@/main/core/services/work-profile.store";

describe("workProfileStore", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "wrisp-work-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("未写入时返回空档案", () => {
    expect(workProfileStore.read(dir)).toEqual({});
  });

  it("写入简报后可读回", () => {
    workProfileStore.write(dir, {
      brief: {
        name: "测试作品",
        type: "novel",
        audience: "青年读者",
        tone: "克制",
        themes: ["成长"],
      },
    });
    const profile = workProfileStore.read(dir);
    expect(profile.brief?.name).toBe("测试作品");
    expect(profile.brief?.themes).toEqual(["成长"]);
  });

  it("写入不会触碰 project.json", () => {
    fs.writeFileSync(path.join(dir, "project.json"), '{"id":"p1"}', "utf-8");
    workProfileStore.write(dir, { brief: { name: "x", type: "novel" } });
    const raw = fs.readFileSync(path.join(dir, "project.json"), "utf-8");
    expect(raw).toBe('{"id":"p1"}');
  });

  it("文件损坏时返回空档案而不抛错", () => {
    fs.writeFileSync(path.join(dir, "work-profile.json"), "{not json", "utf-8");
    expect(workProfileStore.read(dir)).toEqual({});
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/work-profile.store.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 新增类型与 store**

```ts
// src/shared/types/work-profile.types.ts
import type { ProjectType } from "@/shared/enums/project.enums";

/** 作品简报：新建作品时由交互问答采集 */
export interface WorkBrief {
  name: string;
  type: ProjectType;
  audience?: string;
  lengthTarget?: string;
  pov?: string;
  tone?: string;
  themes?: string[];
  taboos?: string[];
  references?: string[];
}

/** 作品风格：单作品作用域 */
export interface WorkStyle {
  tone: string;
  pov: string;
  voiceByRole?: Record<string, string>;
  glossary?: Array<{ term: string; definition: string }>;
  constraints?: string[];
}

/** 作品档案（<作品文件夹>/work-profile.json） */
export interface WorkProfile {
  brief?: WorkBrief;
  style?: WorkStyle;
}
```

在 `src/shared/types/index.ts` 追加：

```ts
export * from "./work-profile.types";
```

```ts
// src/main/core/services/work-profile.store.ts
import * as fs from "fs";
import * as path from "path";
import { Logger } from "@/main/utils/logger";
import type { WorkProfile } from "@/shared/types";

export const WORK_PROFILE_FILE = "work-profile.json";

export function getWorkProfilePath(projectFilePath: string): string {
  return path.join(projectFilePath, WORK_PROFILE_FILE);
}

/**
 * 作品档案读写。
 * 独立于 project.json —— 后者由 project.service.syncProjectJson() 整份覆盖，
 * 把智能体数据写在那里会被覆盖丢失。
 */
class WorkProfileStore {
  public read(projectFilePath: string): WorkProfile {
    const file = getWorkProfilePath(projectFilePath);
    try {
      if (!fs.existsSync(file)) return {};
      return JSON.parse(fs.readFileSync(file, "utf-8")) as WorkProfile;
    } catch (error) {
      Logger.warn("[WorkProfileStore] 读取作品档案失败", {
        file,
        error: String(error),
      });
      return {};
    }
  }

  public write(projectFilePath: string, profile: WorkProfile): void {
    const file = getWorkProfilePath(projectFilePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(profile, null, 2), "utf-8");
  }

  /** 合并写入（保留未提供的部分） */
  public merge(projectFilePath: string, patch: WorkProfile): WorkProfile {
    const merged: WorkProfile = { ...this.read(projectFilePath), ...patch };
    this.write(projectFilePath, merged);
    return merged;
  }
}

export const workProfileStore = new WorkProfileStore();
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/work-profile.store.test.ts`
Expected: PASS（4 个用例）

- [ ] **Step 5: 类型检查与提交**

Run: `pnpm typecheck` —— 通过

```bash
git add src/shared/types/work-profile.types.ts src/shared/types/index.ts src/main/core/services/work-profile.store.ts tests/unit/main/work-profile.store.test.ts
git commit -m "feat: 新增作品简报/风格类型与作品档案存储"
```

---

### Task 2: 作品采集问题清单（纯函数）

**Files:**
- Create: `src/main/core/services/work-intake.ts`
- Test: `tests/unit/main/work-intake.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `WorkBrief`
- Produces:
  - `interface IntakeQuestion { key: keyof WorkBrief; prompt: string; required: boolean }`
  - `buildIntakeQuestions(type: ProjectType): IntakeQuestion[]`
  - `answersToWorkBrief(type: ProjectType, answers: Record<string, string>): WorkBrief`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from "vitest";
import {
  buildIntakeQuestions,
  answersToWorkBrief,
} from "@/main/core/services/work-intake";
import { PROJECT_TYPE } from "@/shared/enums/project.enums";

describe("work-intake", () => {
  it("问题清单必含作品名与类型无关的基础项", () => {
    const qs = buildIntakeQuestions(PROJECT_TYPE.NOVEL);
    const keys = qs.map((q) => q.key);
    expect(keys).toContain("name");
    expect(keys).toContain("audience");
  });

  it("研究类作品会追问参考文献，小说类不会", () => {
    const research = buildIntakeQuestions(PROJECT_TYPE.RESEARCH).map((q) => q.key);
    const novel = buildIntakeQuestions(PROJECT_TYPE.NOVEL).map((q) => q.key);
    expect(research).toContain("references");
    expect(novel).not.toContain("references");
  });

  it("answersToWorkBrief 把 answers 归集为 WorkBrief", () => {
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
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/work-intake.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现纯函数**

```ts
// src/main/core/services/work-intake.ts
import { PROJECT_TYPE, type ProjectType } from "@/shared/enums/project.enums";
import type { WorkBrief } from "@/shared/types";

export interface IntakeQuestion {
  key: keyof WorkBrief;
  prompt: string;
  required: boolean;
}

const BASE_QUESTIONS: IntakeQuestion[] = [
  { key: "name", prompt: "这部作品叫什么名字？", required: true },
  { key: "audience", prompt: "主要写给谁看？", required: false },
  { key: "tone", prompt: "希望整体基调是什么样的？", required: false },
  { key: "lengthTarget", prompt: "预期篇幅大概多少？", required: false },
  { key: "pov", prompt: "叙事视角打算用哪一种？", required: false },
  { key: "themes", prompt: "想表达哪些主题？（多个用逗号分隔）", required: false },
  { key: "taboos", prompt: "有哪些内容是你明确不想要的？", required: false },
];

/** 按作品类型生成采集问题清单（研究类额外追问参考文献） */
export function buildIntakeQuestions(type: ProjectType): IntakeQuestion[] {
  if (type === PROJECT_TYPE.RESEARCH) {
    return [
      ...BASE_QUESTIONS,
      {
        key: "references",
        prompt: "有哪些关键的参考文献或资料来源？",
        required: false,
      },
    ];
  }
  return [...BASE_QUESTIONS];
}

/** 逗号分隔文本 → 字符串数组（去空白、去空项） */
function splitList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const items = value
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return items.length > 0 ? items : undefined;
}

/** 把问答结果归集为作品简报 */
export function answersToWorkBrief(
  type: ProjectType,
  answers: Record<string, string>,
): WorkBrief {
  const brief: WorkBrief = {
    name: (answers.name ?? "").trim(),
    type,
  };
  if (answers.audience?.trim()) brief.audience = answers.audience.trim();
  if (answers.tone?.trim()) brief.tone = answers.tone.trim();
  if (answers.lengthTarget?.trim()) {
    brief.lengthTarget = answers.lengthTarget.trim();
  }
  if (answers.pov?.trim()) brief.pov = answers.pov.trim();

  const themes = splitList(answers.themes);
  if (themes) brief.themes = themes;
  const taboos = splitList(answers.taboos);
  if (taboos) brief.taboos = taboos;
  const references = splitList(answers.references);
  if (references) brief.references = references;

  return brief;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/work-intake.test.ts`
Expected: PASS（3 个用例）

- [ ] **Step 5: 类型检查与提交**

Run: `pnpm typecheck` —— 通过

```bash
git add src/main/core/services/work-intake.ts tests/unit/main/work-intake.test.ts
git commit -m "feat: 新增作品采集问题清单与简报归集"
```

---

### Task 3: 作品技能派生（纯函数）

**Files:**
- Create: `src/main/core/skills/work-skill.deriver.ts`
- Test: `tests/unit/main/work-skill.deriver.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `WorkBrief`；**技能作品作用域**计划的 `SkillDefinition.sourceTemplateId`
- Produces: `deriveWorkSkill(source: SkillDefinition, brief: WorkBrief, targetId: string): SkillDefinition`

- [ ] **Step 1: 写失败测试**

```ts
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

  it("把简报信息填入输入参数默认值", () => {
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/work-skill.deriver.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现派生**

```ts
// src/main/core/skills/work-skill.deriver.ts
import type { SkillDefinition } from "@/shared/types/skill.types";
import type { WorkBrief } from "@/shared/types";

/** 简报字段 → 技能输入参数名（用于填充默认值） */
const BRIEF_TO_INPUT: Array<keyof WorkBrief> = [
  "audience",
  "tone",
  "pov",
  "lengthTarget",
];

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * 从全局技能派生作品技能（方案 B：独立副本，可后续编辑）。
 * 不修改来源对象；复制全部字段并写入来源模板 id/版本。
 */
export function deriveWorkSkill(
  source: SkillDefinition,
  brief: WorkBrief,
  targetId: string,
): SkillDefinition {
  const derived = deepClone(source);
  derived.id = targetId;
  derived.sourceTemplateId = source.id;
  derived.sourceTemplateVersion = source.version;

  // 把简报中已有的信息填进同名输入参数的默认值（仅当该参数声明为 string）
  const properties = derived.input?.properties;
  if (properties) {
    for (const key of BRIEF_TO_INPUT) {
      const value = brief[key];
      const prop = properties[key];
      if (typeof value === "string" && prop && prop.type === "string") {
        prop.default = value;
      }
    }
  }

  return derived;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/work-skill.deriver.test.ts`
Expected: PASS（4 个用例）

- [ ] **Step 5: 类型检查与提交**

Run: `pnpm typecheck` —— 通过

```bash
git add src/main/core/skills/work-skill.deriver.ts tests/unit/main/work-skill.deriver.test.ts
git commit -m "feat: 新增作品技能派生（全局模板 → 作品副本）"
```

---

### Task 4: 作品创建收尾编排（无确认门）

**Files:**
- Create: `src/main/core/services/work-creation.service.ts`
- Test: `tests/unit/main/work-creation.service.test.ts`

**Interfaces:**
- Consumes: Task 1 `workProfileStore`、Task 2 `answersToWorkBrief`、Task 3 `deriveWorkSkill`、**技能作品作用域**计划的 `projectSkillStore` 与 `skillManager`
- Produces: `workCreationService.finishCreation(projectId: string, answers: Record<string, string>): { brief: WorkBrief; derivedSkillIds: string[] }`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect, vi } from "vitest";

const findById = vi.fn(() => ({ id: "p1", file_path: "D:/proj/p1/", type: "novel" }));
vi.mock("@/main/core/db", () => ({
  ProjectDao: class {
    findById = findById;
  },
}));

const write = vi.fn();
const merge = vi.fn();
vi.mock("@/main/core/services/work-profile.store", () => ({
  workProfileStore: { write, merge, read: () => ({}) },
}));

const storeWrite = vi.fn();
vi.mock("@/main/core/skills/project-skill.store", () => ({
  projectSkillStore: { write: storeWrite },
}));

const getSkillDefinition = vi.fn((id: string) =>
  id === "outline"
    ? {
        id: "outline",
        name: { zh: "大纲", en: "Outline" },
        description: { zh: "", en: "" },
        icon: "📝",
        version: "1.0.0",
        author: "wrisp",
        category: ["writing"],
        enabled: true,
        promptTemplate: { zh: "{{text}}", en: "{{text}}" },
      }
    : null,
);
vi.mock("@/main/core/skills/skill.manager", () => ({
  skillManager: { getSkillDefinition },
}));

import { workCreationService } from "@/main/core/services/work-creation.service";

describe("workCreationService.finishCreation", () => {
  it("写入简报并派生出作品技能", () => {
    const result = workCreationService.finishCreation("p1", {
      name: "长夜",
      audience: "青年读者",
    });
    expect(result.brief.name).toBe("长夜");
    expect(write).toHaveBeenCalled();
    expect(storeWrite).toHaveBeenCalled();
    expect(result.derivedSkillIds.length).toBeGreaterThan(0);
  });

  it("作品不存在时抛错", () => {
    findById.mockReturnValueOnce(null);
    expect(() => workCreationService.finishCreation("nope", {})).toThrow(
      "PROJECT_NOT_FOUND",
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/work-creation.service.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现编排**

```ts
// src/main/core/services/work-creation.service.ts
import { ProjectDao } from "@/main/core/db";
import { workProfileStore } from "@/main/core/services/work-profile.store";
import { answersToWorkBrief } from "@/main/core/services/work-intake";
import { projectSkillStore } from "@/main/core/skills/project-skill.store";
import { skillManager } from "@/main/core/skills/skill.manager";
import { deriveWorkSkill } from "@/main/core/skills/work-skill.deriver";
import { Logger } from "@/main/utils/logger";
import type { ProjectType } from "@/shared/enums/project.enums";
import type { WorkBrief } from "@/shared/types";

/** 默认派生的全局技能模板（作品技能由其复制而来） */
const DEFAULT_TEMPLATE_SKILL_IDS = ["outline", "continue", "polish"];

class WorkCreationService {
  private static instance: WorkCreationService | null = null;
  private projectDao = new ProjectDao();

  public static getInstance(): WorkCreationService {
    if (!WorkCreationService.instance) {
      WorkCreationService.instance = new WorkCreationService();
    }
    return WorkCreationService.instance;
  }

  /**
   * 作品创建收尾：写入简报 → 自动派生作品技能。
   * 无确认门（spec §5.1）：这是"完成新建作品"的同步副作用。
   */
  public finishCreation(
    projectId: string,
    answers: Record<string, string>,
  ): { brief: WorkBrief; derivedSkillIds: string[] } {
    const project = this.projectDao.findById(projectId);
    if (!project?.file_path) {
      throw new Error(`PROJECT_NOT_FOUND: ${projectId}`);
    }
    const projectFilePath = project.file_path;

    const brief = answersToWorkBrief(
      (project.type ?? "novel") as ProjectType,
      answers,
    );
    workProfileStore.merge(projectFilePath, { brief });

    const derivedSkillIds: string[] = [];
    for (const templateId of DEFAULT_TEMPLATE_SKILL_IDS) {
      const source = skillManager.getSkillDefinition(templateId);
      if (!source) continue;
      const targetId = `work-${templateId}`;
      const derived = deriveWorkSkill(source, brief, targetId);
      try {
        projectSkillStore.write(projectFilePath, derived);
        derivedSkillIds.push(targetId);
      } catch (error) {
        Logger.warn("[WorkCreationService] 作品技能写入失败，已跳过", {
          templateId,
          error: String(error),
        });
      }
    }

    return { brief, derivedSkillIds };
  }
}

export const workCreationService = WorkCreationService.getInstance();
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/work-creation.service.test.ts`
Expected: PASS（2 个用例）

- [ ] **Step 5: 类型检查与提交**

Run: `pnpm typecheck` —— 通过

```bash
git add src/main/core/services/work-creation.service.ts tests/unit/main/work-creation.service.test.ts
git commit -m "feat: 作品创建收尾自动派生作品技能"
```

---

## 依赖关系

**前置**：技能作品作用域计划（`projectSkillStore`、`SkillDefinition.sourceTemplateId`）。
**被依赖**：P4 页面大纲与分步创作（消费 `WorkBrief` 与作品技能）。

**延后项**：

- **向导 UI 与 IPC 四层**：本计划只做服务层与数据层；渲染层的问答向导、`work:finishCreation` 通道随 P4 一并接入（那时才有完整消费方）。
- **"从模板同步更新"差量合并**：`sourceTemplateVersion` 已就位，同步逻辑待后续。
- **助手在问答中改写作品技能**：依赖编排层（会话/确认门），后续接入。

## 后续计划（本计划不含）

| 计划 | 覆盖 spec 条目 |
|---|---|
| P4 页面大纲与分步创作 | §5.2、§6.6 |
| P3 偏好与风格记忆 | §6.3 |
| P5 审核与委托 | §6.1 |

## 风险与开放问题

| 风险 | 说明 | 缓解 |
|---|---|---|
| **与 spec 存储落点不一致** | spec 说存 `project.json`，实测会被 `syncProjectJson()` 覆盖 | 改用独立文件 `work-profile.json`，T1 有"不触碰 project.json"的用例；已在计划开头裁定 |
| 默认派生哪几个技能是硬编码 | `DEFAULT_TEMPLATE_SKILL_IDS` 写死 | 后续可改为按作品类型映射（留待 P4/运营配置） |
| 全局技能缺失时静默跳过 | `skillManager.getSkillDefinition` 返回 null | 已用 `continue` 跳过；若全部缺失则 `derivedSkillIds` 为空，调用方需容错 |
| 作品技能写入失败被吞 | `projectSkillStore.write` 会因 schema 校验失败抛错 | 已 try/catch 并记 warn，不阻断作品创建 |
| 单测无 Electron 运行时 | `skill.manager` 导入链触及 `app` | T4 已 mock `skill.manager`；若仍崩，补 `vi.mock("electron", …)` |
