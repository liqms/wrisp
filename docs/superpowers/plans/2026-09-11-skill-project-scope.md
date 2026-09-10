# 技能作品作用域 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让技能支持"全局 + 作品"两级作用域：作品技能从全局模板派生而来、可独立编辑，解析时按 **作品 → 全局** 的顺序查找。

**Architecture:** 作品技能是**普通 `SkillDefinition` 文件**（放在作品文件夹的 `skills/` 下），额外携带 `sourceTemplateId` / `sourceTemplateVersion` 两个元数据字段用于"有更新可用"提示。新增 `ProjectSkillStore` 负责作品技能目录的读写；`SkillManager.resolveSkillDefinition(skillId, projectId?)` 做两级查找并带按作品的缓存与失效；`SkillExecutor` 接受可选 `projectId` 并改用它解析技能。

**Tech Stack:** TypeScript（strict）、Electron main 进程、Vitest、Ajv（复用既有 `skillSchemaValidator`）。

**Spec:** `docs/superpowers/specs/2026-09-10-creation-agent-design.md`（§4.2 技能三级作用域、§6.2 技能派生与模板同步、§7 I8/I9）

## Global Constraints

- Node.js 24+，包管理用 pnpm。
- TypeScript 严格模式：`noUnusedLocals` 与 `noUnusedParameters` 为**严格**，build 会因未使用变量失败。
- 测试用 Vitest，`globals: true`、`environment: happy-dom`；测试文件放在 `tests/unit/**` 或 `tests/integration/**`。
- 技能定义必须过 `skillSchemaValidator.validate()`，**不得绕过**（项目已知约束）。
- `SkillManager` 初始化顺序不可破坏：`main/index.ts` 在 IPC 注册前初始化技能管理器。
- 枚举遵循 `as const` 对象 + `type X = (typeof X)[keyof typeof X]` 模式。
- 类型级 RED/GREEN 用 `npx vue-tsc --noEmit -p tsconfig.vitest.json`（Vitest 不做类型检查；`pnpm typecheck` 只覆盖 `src/`）。

---

### Task 1: `SkillDefinition` 支持作品技能来源元数据

**Files:**
- Modify: `src/shared/types/skill.types.ts`（`SkillDefinition` 接口）
- Test: `tests/unit/main/skill-definition-source.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `SkillDefinition` 新增可选字段 `sourceTemplateId?: string`、`sourceTemplateVersion?: string`

- [ ] **Step 1: 写类型级失败测试**

```ts
// tests/unit/main/skill-definition-source.test.ts
import { describe, it, expect } from "vitest";
import type { SkillDefinition } from "@/shared/types/skill.types";

describe("SkillDefinition 作品来源元数据", () => {
  it("允许携带 sourceTemplateId / sourceTemplateVersion", () => {
    const skill = {
      id: "work-outline",
      name: { zh: "大纲", en: "Outline" },
      description: { zh: "生成大纲", en: "Generate outline" },
      icon: "📝",
      version: "1.0.0",
      author: "wrisp",
      category: ["writing"],
      enabled: true,
      promptTemplate: { zh: "{{text}}", en: "{{text}}" },
      sourceTemplateId: "outline",
      sourceTemplateVersion: "1.0.0",
    } satisfies SkillDefinition;

    expect(skill.sourceTemplateId).toBe("outline");
    expect(skill.sourceTemplateVersion).toBe("1.0.0");
  });
});
```

- [ ] **Step 2: 运行类型检查确认失败**

Run: `npx vue-tsc --noEmit -p tsconfig.vitest.json`
Expected: FAIL —— `skill-definition-source.test.ts` 报 `TS2353`（`sourceTemplateId` 不存在于 `SkillDefinition`）

- [ ] **Step 3: 扩展类型**

在 `src/shared/types/skill.types.ts` 的 `SkillDefinition` 中，于 `example?: SkillExample;` 之后追加：

```ts
  /** 作品技能的来源全局技能 id（仅作品作用域使用） */
  sourceTemplateId?: string;
  /** 派生时所依据的全局技能版本，用于"有更新可用"提示（仅作品作用域使用） */
  sourceTemplateVersion?: string;
```

- [ ] **Step 4: 运行类型检查确认通过**

Run: `npx vue-tsc --noEmit -p tsconfig.vitest.json`
Expected: 该测试文件无报错（该 tsconfig 下有既有的、与本计划无关的报错，只看本文件）

- [ ] **Step 5: 提交**

```bash
git add src/shared/types/skill.types.ts tests/unit/main/skill-definition-source.test.ts
git commit -m "feat: SkillDefinition 支持作品技能来源元数据"
```

---

### Task 2: `ProjectSkillStore` — 作品技能目录读写

**Files:**
- Create: `src/main/core/skills/project-skill.store.ts`
- Test: `tests/unit/main/project-skill.store.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `SkillDefinition.sourceTemplateId` / `sourceTemplateVersion`
- Produces:
  - `getProjectSkillsDir(projectFilePath: string): string`
  - `projectSkillStore.list(projectFilePath: string): SkillDefinition[]`
  - `projectSkillStore.read(projectFilePath: string, skillId: string): SkillDefinition | null`
  - `projectSkillStore.write(projectFilePath: string, skill: SkillDefinition): void`
  - `projectSkillStore.remove(projectFilePath: string, skillId: string): void`

- [ ] **Step 1: 写失败测试**

```ts
// tests/unit/main/project-skill.store.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  projectSkillStore,
  getProjectSkillsDir,
} from "@/main/core/skills/project-skill.store";
import type { SkillDefinition } from "@/shared/types/skill.types";

function makeSkill(id: string): SkillDefinition {
  return {
    id,
    name: { zh: id, en: id },
    description: { zh: "", en: "" },
    icon: "📝",
    version: "1.0.0",
    author: "test",
    category: ["writing"],
    enabled: true,
    promptTemplate: { zh: "{{text}}", en: "{{text}}" },
    sourceTemplateId: "outline",
    sourceTemplateVersion: "1.0.0",
  };
}

describe("ProjectSkillStore", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "wrisp-proj-"));
  });

  afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it("技能目录位于作品文件夹下的 skills/", () => {
    expect(getProjectSkillsDir(projectDir)).toBe(
      path.join(projectDir, "skills"),
    );
  });

  it("写入后可读回，且保留来源元数据", () => {
    projectSkillStore.write(projectDir, makeSkill("work-outline"));
    const read = projectSkillStore.read(projectDir, "work-outline");
    expect(read?.sourceTemplateId).toBe("outline");
    expect(read?.sourceTemplateVersion).toBe("1.0.0");
  });

  it("目录不存在时 list 返回空数组", () => {
    expect(projectSkillStore.list(path.join(projectDir, "nope"))).toEqual([]);
  });

  it("remove 删除对应文件", () => {
    projectSkillStore.write(projectDir, makeSkill("work-outline"));
    projectSkillStore.remove(projectDir, "work-outline");
    expect(projectSkillStore.read(projectDir, "work-outline")).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/project-skill.store.test.ts`
Expected: FAIL —— 模块不存在

- [ ] **Step 3: 实现 store**

```ts
// src/main/core/skills/project-skill.store.ts
import * as fs from "fs";
import * as path from "path";
import { Logger } from "@/main/utils/logger";
import { skillSchemaValidator } from "./skill.schema.validator";
import type { SkillDefinition } from "@/shared/types/skill.types";

/** 作品技能目录：<作品文件夹>/skills/ */
export function getProjectSkillsDir(projectFilePath: string): string {
  return path.join(projectFilePath, "skills");
}

function skillFilePath(projectFilePath: string, skillId: string): string {
  return path.join(getProjectSkillsDir(projectFilePath), `${skillId}.skill.json`);
}

/**
 * 作品技能存储：读写 <作品文件夹>/skills/*.skill.json。
 * 写入前统一走 schema 校验，与全局技能一致，不绕过。
 */
class ProjectSkillStore {
  public list(projectFilePath: string): SkillDefinition[] {
    const dir = getProjectSkillsDir(projectFilePath);
    if (!fs.existsSync(dir)) return [];

    let files: string[];
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith(".skill.json"));
    } catch (error) {
      Logger.warn("[ProjectSkillStore] 读取作品技能目录失败", {
        dir,
        error: String(error),
      });
      return [];
    }

    const result: SkillDefinition[] = [];
    for (const file of files) {
      const parsed = this.readFile(path.join(dir, file));
      if (parsed) result.push(parsed);
    }
    return result;
  }

  public read(projectFilePath: string, skillId: string): SkillDefinition | null {
    return this.readFile(skillFilePath(projectFilePath, skillId));
  }

  public write(projectFilePath: string, skill: SkillDefinition): void {
    const validation = skillSchemaValidator.validate(skill);
    if (!validation.valid) {
      const errors = validation.errors
        .map((e) => `${e.field}: ${e.message}`)
        .join("; ");
      throw new Error(`INVALID_PROJECT_SKILL: ${skill.id} — ${errors}`);
    }
    const file = skillFilePath(projectFilePath, skill.id);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(skill, null, 2), "utf-8");
  }

  public remove(projectFilePath: string, skillId: string): void {
    const file = skillFilePath(projectFilePath, skillId);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  private readFile(file: string): SkillDefinition | null {
    try {
      if (!fs.existsSync(file)) return null;
      const skill = JSON.parse(fs.readFileSync(file, "utf-8")) as SkillDefinition;
      const validation = skillSchemaValidator.validate(skill);
      if (!validation.valid) {
        Logger.warn("[ProjectSkillStore] 作品技能校验失败，已跳过", { file });
        return null;
      }
      return skill;
    } catch (error) {
      Logger.warn("[ProjectSkillStore] 读取作品技能失败", {
        file,
        error: String(error),
      });
      return null;
    }
  }
}

export const projectSkillStore = new ProjectSkillStore();
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/project-skill.store.test.ts`
Expected: PASS（4 个用例）

- [ ] **Step 5: 类型检查**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 6: 提交**

```bash
git add src/main/core/skills/project-skill.store.ts tests/unit/main/project-skill.store.test.ts
git commit -m "feat: 新增作品技能存储（作品文件夹 skills/）"
```

---

### Task 3: `SkillManager` 两级解析（作品 → 全局）

**Files:**
- Modify: `src/main/core/skills/skill.manager.ts`
- Test: `tests/unit/main/skill-manager-project-scope.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `projectSkillStore`、`ProjectDao`（`@/main/core/db`，用 `findById(projectId).file_path`）
- Produces:
  - `skillManager.resolveSkillDefinition(skillId: string, projectId?: string): SkillDefinition | null`
  - `skillManager.invalidateProjectSkills(projectId: string): void`

- [ ] **Step 1: 写失败测试**

```ts
// tests/unit/main/skill-manager-project-scope.test.ts
import { describe, it, expect, vi } from "vitest";

// 单测环境没有 Electron 运行时：skillSchemaValidator / Logger 等模块在导入期会调用
// app.getAppPath()，不 mock 会抛 "Cannot read properties of undefined (reading 'getAppPath')"。
vi.mock("electron", () => ({
  app: {
    getAppPath: () => process.cwd(),
    getPath: () => process.cwd(),
  },
}));

const findById = vi.fn();
vi.mock("@/main/core/db", () => ({
  ProjectDao: class {
    findById = findById;
  },
}));

const storeList = vi.fn(() => []);
vi.mock("@/main/core/skills/project-skill.store", () => ({
  projectSkillStore: { list: storeList, read: vi.fn(), write: vi.fn(), remove: vi.fn() },
  getProjectSkillsDir: (p: string) => `${p}/skills`,
}));

import { skillManager } from "@/main/core/skills/skill.manager";
import type { SkillDefinition } from "@/shared/types/skill.types";

describe("SkillManager 两级解析", () => {
  it("作品技能存在时优先于全局", () => {
    findById.mockReturnValue({ id: "p1", file_path: "D:/proj/p1/" });
    skillManager.invalidateProjectSkills("p1");
    const workSkill = {
      id: "outline",
      name: { zh: "作品大纲", en: "Work outline" },
      description: { zh: "", en: "" },
      icon: "📝",
      version: "1.0.0",
      author: "t",
      category: ["writing"],
      enabled: true,
      promptTemplate: { zh: "work", en: "work" },
      sourceTemplateId: "outline",
      sourceTemplateVersion: "1.0.0",
    } satisfies SkillDefinition;
    storeList.mockReturnValue([workSkill]);

    const resolved = skillManager.resolveSkillDefinition("outline", "p1");
    expect(resolved?.promptTemplate).toEqual({ zh: "work", en: "work" });
  });

  it("作品技能缺失时回退全局", () => {
    findById.mockReturnValue({ id: "p2", file_path: "D:/proj/p2/" });
    skillManager.invalidateProjectSkills("p2");
    storeList.mockReturnValue([]);

    // 全局技能表在未 initialize() 时为空，这里只断言"不为作品技能"
    const resolved = skillManager.resolveSkillDefinition("does-not-exist", "p2");
    expect(resolved).toBeNull();
  });

  it("未传 projectId 时只查全局", () => {
    storeList.mockClear();
    const resolved = skillManager.resolveSkillDefinition("does-not-exist");
    expect(resolved).toBeNull();
    expect(storeList).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/skill-manager-project-scope.test.ts`
Expected: FAIL —— `resolveSkillDefinition` 未定义

- [ ] **Step 3: 实现两级解析**

在 `src/main/core/skills/skill.manager.ts` 顶部新增导入：

```ts
import { ProjectDao } from "@/main/core/db";
import { projectSkillStore } from "./project-skill.store";
```

在 `SkillManager` 类中新增成员与方法：

```ts
  private projectDao = new ProjectDao();
  private projectSkillsCache: Map<string, Map<string, SkillDefinition>> =
    new Map();

  /**
   * 解析技能：作品作用域优先，未命中回退全局。
   * 未传 projectId 时只查全局。
   */
  public resolveSkillDefinition(
    skillId: string,
    projectId?: string,
  ): SkillDefinition | null {
    if (projectId) {
      const workSkill = this.getProjectSkill(skillId, projectId);
      if (workSkill) return workSkill;
    }
    return this.skills.get(skillId) || null;
  }

  /** 清空某作品的作品技能缓存（作品技能被改写/删除后调用） */
  public invalidateProjectSkills(projectId: string): void {
    this.projectSkillsCache.delete(projectId);
  }

  private getProjectSkill(
    skillId: string,
    projectId: string,
  ): SkillDefinition | null {
    let cache = this.projectSkillsCache.get(projectId);
    if (!cache) {
      cache = new Map();
      const project = this.projectDao.findById(projectId);
      if (!project?.file_path) {
        this.projectSkillsCache.set(projectId, cache);
        return null;
      }
      for (const skill of projectSkillStore.list(project.file_path)) {
        cache.set(skill.id, skill);
      }
      this.projectSkillsCache.set(projectId, cache);
    }
    return cache.get(skillId) ?? null;
  }
```

> 说明：这里用 `projectSkillStore.list()` 一次性载入该作品全部技能并缓存，避免每次解析都做一次文件读取；`read()` 仅用于测试与单点读取。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/skill-manager-project-scope.test.ts`
Expected: PASS（3 个用例）

> 若测试因缓存跨用例串味而失败，在每个用例开头调用 `skillManager.invalidateProjectSkills(<该用例的 projectId>)` 重置。

- [ ] **Step 5: 类型检查**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 6: 提交**

```bash
git add src/main/core/skills/skill.manager.ts tests/unit/main/skill-manager-project-scope.test.ts
git commit -m "feat: SkillManager 支持作品作用域解析（作品优先，回退全局）"
```

---

### Task 4: `SkillExecutor` 接受 `projectId` 并按作用域解析

**Files:**
- Modify: `src/main/core/skills/skill.executor.ts`（`execute` 与 `executeL1Stream`）
- Test: `tests/unit/main/skill-executor-project-scope.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `skillManager.resolveSkillDefinition(skillId, projectId?)`
- Produces:
  - `skillExecutor.execute(skillId: string, inputs: Record<string, unknown>, projectId?: string): Promise<SkillExecuteResult>`
  - `skillExecutor.executeL1Stream(skillId: string, inputs: Record<string, unknown>, projectId?: string): AsyncIterable<...>`

- [ ] **Step 1: 写失败测试**

```ts
// tests/unit/main/skill-executor-project-scope.test.ts
import { describe, it, expect, vi } from "vitest";

// 单测环境没有 Electron 运行时（理由同 T3）
vi.mock("electron", () => ({
  app: {
    getAppPath: () => process.cwd(),
    getPath: () => process.cwd(),
  },
}));

const resolveSkillDefinition = vi.fn(() => null);
vi.mock("@/main/core/skills/skill.manager", () => ({
  skillManager: { resolveSkillDefinition },
}));

// tool.registry 会连带拉入 material-search.service → chunk.service 等重依赖链
// （Task 8 曾因此在 tests/unit/main/tool-registry.test.ts 触发 app.getAppPath 崩溃），
// 这里连同 ai.service 一起 mock，保证本测试只关注"解析走了哪条路径"。
vi.mock("@/main/core/skills/tool.registry", () => ({
  toolRegistry: {
    resolveTools: () => [],
    getToolsForLLM: () => [],
    execute: vi.fn(),
  },
}));
vi.mock("@/main/core/services/ai.service", () => ({
  aiService: { chatCompletion: vi.fn() },
}));

import { skillExecutor } from "@/main/core/skills/skill.executor";

describe("SkillExecutor 按作品解析技能", () => {
  it("execute 把 projectId 交给 resolveSkillDefinition", async () => {
    await expect(
      skillExecutor.execute("outline", { text: "x" }, "p1"),
    ).rejects.toThrow("SKILL_NOT_FOUND: outline");
    expect(resolveSkillDefinition).toHaveBeenCalledWith("outline", "p1");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/main/skill-executor-project-scope.test.ts`
Expected: FAIL —— `execute` 未使用 `resolveSkillDefinition`（第三个参数被忽略）

- [ ] **Step 3: 改造执行器**

`src/main/core/skills/skill.executor.ts` 的 `execute`：

```ts
  async execute(
    skillId: string,
    inputs: Record<string, unknown>,
    projectId?: string,
  ): Promise<SkillExecuteResult> {
    const startTime = Date.now();
    const skill = skillManager.resolveSkillDefinition(skillId, projectId);
    if (!skill) {
      throw new Error(`SKILL_NOT_FOUND: ${skillId}`);
    }
```

`executeL1Stream` 同样改为：

```ts
  async *executeL1Stream(
    skillId: string,
    inputs: Record<string, unknown>,
    projectId?: string,
  ): AsyncIterable<{ delta: string; done: boolean; error?: string }> {
    const skill = skillManager.resolveSkillDefinition(skillId, projectId);
    if (!skill) {
      yield { delta: "", done: true, error: `SKILL_NOT_FOUND: ${skillId}` };
      return;
    }
```

> `skillManager.getSkillDefinition()` 保留不动，供不需要作品作用域的既有调用方使用。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test tests/unit/main/skill-executor-project-scope.test.ts`
Expected: PASS

- [ ] **Step 5: 类型检查**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 6: 提交**

```bash
git add src/main/core/skills/skill.executor.ts tests/unit/main/skill-executor-project-scope.test.ts
git commit -m "feat: SkillExecutor 支持按作品解析技能"
```

---

## 后续计划（本计划不含）

| 计划 | 覆盖 spec 条目 |
|---|---|
| 创作会话与确认门 | I6、I7、§6.1、§6.4 |
| 模板页面级技能 | I5、§6.5 |
| P1 作品采集向导 + P2 作品技能派生 | §5.1、§6.2 |
| P4 页面大纲与分步创作 | §5.2、§6.6 |
| P3 偏好与风格记忆 | §6.3 |
| P5 审核与委托 | §6.1 |

**已识别但延后的项**：

- **IPC 透传 `projectId`**（`skill:execute` / `skill:executeStream` 增加第三参，连带 preload 类型与 `electron.d.ts`）。延后理由与素材检索计划一致——目前没有渲染层消费方；等 P4 页面创作链路真正需要时随该计划一并接入，避免现在接一条无消费方的通道。
- **"从模板同步更新"的差量合并**（§6.2）。依赖作品技能已能创建（P2），本计划只埋下 `sourceTemplateId` / `sourceTemplateVersion` 两个字段。
- **第三级"页面（模板级）"作用域**（§4.2 的第三级）。本计划只落地"作品 → 全局"两级；模板声明的页面级技能由**模板页面级技能**计划通过 pipeline 解析实现（模板只引用技能 id，不新增加载路径）。

## 风险与开放问题

| 风险 | 说明 | 缓解 |
|---|---|---|
| `SkillManager` 新增对 `ProjectDao` 的依赖 | 该单例在导入期构造，测试需 mock `@/main/core/db` | 测试中 `vi.mock`（本计划 T3 已给） |
| 作品技能缓存跨用例串味 | `projectSkillsCache` 是实例状态 | 用例间调用 `invalidateProjectSkills` |
| 项目删除后缓存残留 | 缓存以 `projectId` 为键 | 在项目删除流程中调用 `invalidateProjectSkills`（留待 P1/P2 计划接入） |
| `getSkillDefinition` 与 `resolveSkillDefinition` 并存 | 两套入口易混用 | 计划明确：需要作品作用域的场景一律用 `resolveSkillDefinition` |
| **单测缺 Electron 运行时** | `skillSchemaValidator` / `Logger` 等在导入期调用 `app.getAppPath()`；`tool.registry` 还会拉入 `material-search.service → chunk.service` 重依赖链 | T3/T4 测试已显式 `vi.mock("electron", …)`，T4 另 mock `tool.registry` 与 `ai.service`（教训来自上一份计划 Task 8 的真实崩溃） |
