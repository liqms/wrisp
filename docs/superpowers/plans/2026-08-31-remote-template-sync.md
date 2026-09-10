# 远程模板同步 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现统一的远程模板同步机制，覆盖 slash/page/skill 三类模板，启动时自动从 GitHub 同步到本地工作区 `resources/`，替代当前 TS 硬编码与自定义服务器更新机制。

**Architecture:** 单一存储位置 `<workspace>/resources/`（内置+远程同源），打包时复制 `resources/` 到 `dist-electron/`，首次启动从打包目录复制到工作区，后续启动异步检查 GitHub raw URL 拉取 manifest 比对版本+sha256 增量更新。`ResourceType` 枚举可扩展。

**Tech Stack:** Electron + Vue 3 + TypeScript + Vite + Vitest + better-sqlite3。复用 `ResponseWrapper`、`compareVersions`、`NodeCryptoUtil.sha256`、`FileService`、`Logger`。

**参考设计文档：** [docs/superpowers/specs/2026-08-31-remote-template-sync-design.md](file:///d:/Code/Github/Wrisp/docs/superpowers/specs/2026-08-31-remote-template-sync-design.md)

---

## 文件结构总览

### 新增文件

| 文件 | 职责 |
|---|---|
| `src/shared/enums/resource.enums.ts` | `ResourceType` 枚举 |
| `src/shared/types/resource.types.ts` | `RemoteManifest` / `ManifestEntry` / `SyncStatus` / `SyncResult` 类型 |
| `src/main/constants/resource.constants.ts` | GitHub 仓库配置、超时、目录名常量 |
| `src/main/core/services/resource-manifest.ts` | manifest 解析、比对、hash 计算 |
| `src/main/core/services/resource-http.client.ts` | raw URL 下载 + 超时/重试 |
| `src/main/core/services/resource-sync.service.ts` | 同步服务主逻辑 |
| `src/main/core/apis/resource.api.ts` | IPC API 层 |
| `src/main/ipcMain/resource.ipc.ts` | IPC handler |
| `src/main/preload/modules/resource.ts` | preload 模块 |
| `src/main/preload/types/resource.ts` | preload 类型声明 |
| `resources/manifest.json` | 总清单 |
| `resources/slash/*.json` | 18 个 slash 模板文件 |
| `resources/page/*.json` | 5 个 page 模板文件 |
| `scripts/generate-manifest.mjs` | manifest 生成脚本 |
| `tests/unit/main/resource-manifest.test.ts` | manifest 单元测试 |
| `tests/unit/main/resource-http.client.test.ts` | HTTP 客户端单元测试 |
| `tests/unit/main/resource-sync.service.test.ts` | 同步服务单元测试 |
| `tests/unit/main/resource.api.test.ts` | API 层单元测试 |
| `tests/unit/shared/resource-types.test.ts` | 类型守卫测试 |

### 修改文件

| 文件 | 改动 |
|---|---|
| `src/shared/types/template.types.ts` | 新增 `TemplateResourceFile` 类型 |
| `src/shared/types/index.ts` | 导出 `resource.types` |
| `src/shared/enums/index.ts` | 导出 `resource.enums` |
| `src/shared/enums/errorCode.enums.ts` | 新增 `RESOURCE_SYNC_FAILED` 等错误码 |
| `src/main/constants/folder.constants.ts` | 新增 `RESOURCES_DIR` 常量 |
| `src/main/constants/index.ts` | 导出 `resource.constants` |
| `src/main/core/services/template.service.ts` | 新增 `getBuiltInTemplates(type)` |
| `src/main/core/apis/template.api.ts` | 新增 `getBuiltIn` 函数 |
| `src/main/ipcMain/template.ipc.ts` | 注册 `template:getBuiltIn` 通道 |
| `src/main/preload/modules/template.ts` | 新增 `getBuiltIn` 方法 |
| `src/main/preload/types/template.ts` | 新增 `getBuiltIn` 类型 |
| `src/main/core/skills/skill.manager.ts` | `loadSkills` 改扫描 `<workspace>/resources/skills/`；移除 `syncBuiltInSkills`/`copyBuiltInSkills` |
| `src/shared/types/skill.types.ts` | `SkillSource` 移除 `"remote"` |
| `src/main/core/services/base/workspace-init.service.ts` | `ensureWorkspace` 增加首次复制 resources 逻辑 |
| `src/main/index.ts` | 注册 `registerResourceHandlers`、启动时调用 `resourceSyncService.checkAndSync()` |
| `src/main/ipcMain/index.ts` | 导出 `registerResourceHandlers` |
| `src/main/preload/modules/index.ts` | 注册 `resourceModule` |
| `src/renderer/types/electron.d.ts` | 新增 `resource` API 声明 |
| `src/renderer/store/template.store.ts` | 内置改走 IPC 加载、监听 `resource:updated` |
| `src/renderer/components/editor/slash/commands/templates.ts` | 删除 `builtinTemplates` 字面量，保留 `buildTemplateGroup` |
| `src/renderer/components/editor/slash/commands/template-merge.ts` | 入参类型从 `BuiltInTemplateDef[]` 改为 `TemplateResourceFile[]` |
| `src/renderer/components/settings/TemplateSettings.vue` | 新增来源标识、版本号、tags 筛选、同步按钮 |
| `vite.config.mts` | 新增 `copyResources()` |
| `tests/unit/renderer/template-merge.test.ts` | 适配新入参类型 |
| `tests/unit/renderer/slash-templates.test.ts` | 适配删除 `builtinTemplates` |
| `tests/unit/main/template.api.test.ts` | 新增 `getBuiltIn` 用例 |

### 删除文件

| 文件 | 原因 |
|---|---|
| `src/main/core/skills/skill.updater.ts` | 远程同步统一由 resource-sync 处理 |
| `src/renderer/templates/builtin-page-templates.ts` | 内置模板迁移为 JSON |
| `tests/unit/renderer/builtin-page-templates.test.ts` | 对应源文件已删除 |

---

## Phase 1: 共享基础（类型、枚举、常量）

### Task 1: 新增 ResourceType 枚举

**Files:**
- Create: `src/shared/enums/resource.enums.ts`
- Modify: `src/shared/enums/index.ts`
- Test: `tests/unit/shared/resource-types.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/shared/resource-types.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import {
  RESOURCE_TYPE,
  RESOURCE_TYPES,
  isResourceType,
  type ResourceType,
} from "@/shared/enums/resource.enums";

describe("ResourceType 枚举", () => {
  it("包含 slash/page/skill 三种类型", () => {
    expect(RESOURCE_TYPE.SLASH).toBe("slash");
    expect(RESOURCE_TYPE.PAGE).toBe("page");
    expect(RESOURCE_TYPE.SKILL).toBe("skill");
  });

  it("RESOURCE_TYPES 数组包含全部三种类型", () => {
    expect(RESOURCE_TYPES).toHaveLength(3);
    expect(RESOURCE_TYPES).toContain("slash");
    expect(RESOURCE_TYPES).toContain("page");
    expect(RESOURCE_TYPES).toContain("skill");
  });

  it("isResourceType 合法值返回 true", () => {
    expect(isResourceType("slash")).toBe(true);
    expect(isResourceType("page")).toBe(true);
    expect(isResourceType("skill")).toBe(true);
  });

  it("isResourceType 非法值返回 false", () => {
    expect(isResourceType("unknown")).toBe(false);
    expect(isResourceType("")).toBe(false);
    expect(isResourceType(null)).toBe(false);
    expect(isResourceType(123)).toBe(false);
  });

  it("ResourceType 类型可赋值（编译期检查）", () => {
    const t: ResourceType = RESOURCE_TYPE.SLASH;
    expect(t).toBe("slash");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test tests/unit/shared/resource-types.test.ts`
Expected: FAIL，`Cannot find module '@/shared/enums/resource.enums'`

- [ ] **Step 3: 创建枚举文件**

创建 `src/shared/enums/resource.enums.ts`：

```ts
/**
 * 远程资源类型枚举。
 * 用于 manifest.json 中标注每个文件归属的子系统，
 * 后续新增类型（如 prompt/snippet）在此追加。
 */
export const RESOURCE_TYPE = {
  SLASH: "slash",
  PAGE: "page",
  SKILL: "skill",
} as const;

export type ResourceType = (typeof RESOURCE_TYPE)[keyof typeof RESOURCE_TYPE];

export const RESOURCE_TYPES: readonly ResourceType[] = [
  RESOURCE_TYPE.SLASH,
  RESOURCE_TYPE.PAGE,
  RESOURCE_TYPE.SKILL,
];

export function isResourceType(value: unknown): value is ResourceType {
  return (
    typeof value === "string" &&
    (RESOURCE_TYPES as readonly string[]).includes(value)
  );
}
```

- [ ] **Step 4: 在 enums/index.ts 导出**

修改 `src/shared/enums/index.ts`，末尾追加：

```ts
export * from './resource.enums'
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm test tests/unit/shared/resource-types.test.ts`
Expected: PASS，5 个用例全通过

- [ ] **Step 6: 提交**

```bash
git add src/shared/enums/resource.enums.ts src/shared/enums/index.ts tests/unit/shared/resource-types.test.ts
git commit -m "feat(resource): add ResourceType enum for remote template sync"
```

---

### Task 2: 新增资源类型定义

**Files:**
- Create: `src/shared/types/resource.types.ts`
- Modify: `src/shared/types/index.ts`

- [ ] **Step 1: 创建类型文件**

创建 `src/shared/types/resource.types.ts`：

```ts
import type { ResourceType } from "@/shared/enums/resource.enums";

/** manifest.json 中单个文件条目 */
export interface ManifestEntry {
  type: ResourceType;
  /** 相对 resources/ 的路径，如 "slash/todo.json" */
  path: string;
  /** 单文件语义化版本，如 "1.0.0" */
  version: string;
  /** 文件内容 SHA256 hash（hex） */
  sha256: string;
}

/** resources/manifest.json 顶层结构 */
export interface RemoteManifest {
  /** manifest 整体版本（任意文件变更时递增） */
  version: string;
  /** 远程清单更新时间（ISO 8601） */
  updatedAt: string;
  /** 文件条目列表 */
  files: ManifestEntry[];
}

/** 本地工作区缓存的 manifest（与 RemoteManifest 结构一致） */
export type LocalManifest = RemoteManifest;

/** 同步状态 */
export interface SyncStatus {
  syncing: boolean;
  lastSyncAt: string | null;
  lastSyncSuccess: boolean;
  lastError: string | null;
}

/** 单次同步结果 */
export interface SyncResult {
  success: boolean;
  /** 本次同步涉及的资源类型（用于渲染层定向刷新） */
  changedTypes: ResourceType[];
  added: string[];
  updated: string[];
  error?: string;
}

export const EMPTY_SYNC_STATUS: SyncStatus = {
  syncing: false,
  lastSyncAt: null,
  lastSyncSuccess: false,
  lastError: null,
};
```

- [ ] **Step 2: 在 types/index.ts 导出**

修改 `src/shared/types/index.ts`，末尾追加：

```ts
export * from "./resource.types";
```

- [ ] **Step 3: 提交**

```bash
git add src/shared/types/resource.types.ts src/shared/types/index.ts
git commit -m "feat(resource): add RemoteManifest/SyncStatus types"
```

---

### Task 3: 新增资源常量

**Files:**
- Create: `src/main/constants/resource.constants.ts`
- Modify: `src/main/constants/index.ts`
- Modify: `src/main/constants/folder.constants.ts`

- [ ] **Step 1: 创建资源常量文件**

创建 `src/main/constants/resource.constants.ts`：

```ts
/**
 * 远程资源同步常量。
 * 数据源为 GitHub 仓库原始文件（raw.githubusercontent.com），公开仓库匿名访问。
 */
export const RESOURCE_REPO = {
  owner: "liqms",
  repo: "wrisp",
  branch: "main",
  rawBase: "https://raw.githubusercontent.com",
} as const;

export const RESOURCE_CONFIG = {
  resourcesDir: "resources",
  manifestPath: "resources/manifest.json",
  requestTimeout: 15000,
  maxRetries: 2,
  retryDelayMs: 1000,
} as const;
```

- [ ] **Step 2: 在 folder.constants.ts 新增 RESOURCES_DIR**

修改 `src/main/constants/folder.constants.ts`，在 `SQLITE_DIR` 定义之后追加：

```ts
/** 远程资源目录（工作空间下，内置+远程同步的统一存储） */
export const RESOURCES_DIR = "resources" as const;
```

- [ ] **Step 3: 在 constants/index.ts 导出**

修改 `src/main/constants/index.ts`，末尾追加：

```ts
export * from './resource.constants';
```

- [ ] **Step 4: typecheck**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 5: 提交**

```bash
git add src/main/constants/resource.constants.ts src/main/constants/index.ts src/main/constants/folder.constants.ts
git commit -m "feat(resource): add resource sync constants"
```

---

### Task 4: 新增资源错误码

**Files:**
- Modify: `src/shared/enums/errorCode.enums.ts`

- [ ] **Step 1: 在 ErrorCode 枚举中新增资源错误码**

修改 `src/shared/enums/errorCode.enums.ts`，在 `ATTACHMENT_FILE_COPY_FAILED = "ERROR.ATTACHMENT.FILE_COPY_FAILED",` 行之后追加：

```ts

  // ============ 资源同步错误 ============
  RESOURCE_SYNC_FAILED = "ERROR.RESOURCE.SYNC_FAILED",
  RESOURCE_MANIFEST_FETCH_FAILED = "ERROR.RESOURCE.MANIFEST_FETCH_FAILED",
  RESOURCE_FILE_DOWNLOAD_FAILED = "ERROR.RESOURCE.FILE_DOWNLOAD_FAILED",
```

- [ ] **Step 2: 在 ErrorCategory 联合类型新增 RESOURCE**

修改同一文件 `export type ErrorCategory =` 联合类型，在 `| "ATTACHMENT"` 之后追加：

```ts
  | "RESOURCE" // 资源同步错误
```

- [ ] **Step 3: 在 getErrorCategory switch 与 getErrorCategoryMap 字面量新增 RESOURCE 分支**

在 `getErrorCategory` switch 中 `case "ATTACHMENT":` 之后追加：

```ts
    case "RESOURCE":
      return "RESOURCE";
```

在 `getErrorCategoryMap` 的 `categoryMap` 字面量中 `ATTACHMENT: [],` 之后追加：

```ts
    RESOURCE: [],
```

- [ ] **Step 4: typecheck**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 5: 提交**

```bash
git add src/shared/enums/errorCode.enums.ts
git commit -m "feat(resource): add RESOURCE error codes"
```

---

## Phase 2: 数据迁移（TS 硬编码 → JSON 文件）

### Task 5: 迁移 slash 内置模板为 JSON 文件

**Files:**
- Create: 18 个 `resources/slash/*.json` 文件

**说明：** 数据来源为 `src/renderer/components/editor/slash/commands/templates.ts` 的 `builtinTemplates` 字面量。profession 改为数组。新增 `version: "1.0.0"` 与 `tags` 字段。`enabled: true`。本任务仅创建数据文件，不删除 TS 字面量（Task 17 统一删除）。

- [ ] **Step 1: 创建 todo.json**

`resources/slash/todo.json`：

```json
{
  "id": "todo",
  "version": "1.0.0",
  "title": { "zh": "待办清单", "en": "Todo List" },
  "description": { "zh": "插入待办清单", "en": "Insert a todo list" },
  "icon": "check_circle",
  "markdown": {
    "zh": "## 待办清单 - {标题}\n- [ ] {任务1}\n- [ ] {任务2}\n",
    "en": "## Todo List - {title}\n- [ ] {task 1}\n- [ ] {task 2}\n"
  },
  "profession": ["general"],
  "tags": ["list", "todo"],
  "enabled": true
}
```

- [ ] **Step 2: 创建 daily-review.json**

`resources/slash/daily-review.json`：

```json
{
  "id": "daily-review",
  "version": "1.0.0",
  "title": { "zh": "每日回顾", "en": "Daily Review" },
  "description": { "zh": "插入每日回顾框架", "en": "Insert daily review skeleton" },
  "icon": "wb_sunny",
  "markdown": {
    "zh": "## 每日回顾 - {日期}\n- 今日完成：\n- 遇到的问题：\n- 明日计划：\n",
    "en": "## Daily Review - {date}\n- Done today:\n- Blockers:\n- Plan for tomorrow:\n"
  },
  "profession": ["general"],
  "tags": ["review", "daily"],
  "enabled": true
}
```

- [ ] **Step 3: 创建 brainstorm.json**

`resources/slash/brainstorm.json`：

```json
{
  "id": "brainstorm",
  "version": "1.0.0",
  "title": { "zh": "头脑风暴", "en": "Brainstorm" },
  "description": { "zh": "插入头脑风暴框架", "en": "Insert brainstorm skeleton" },
  "icon": "tips_and_updates",
  "markdown": {
    "zh": "## 头脑风暴 - {主题}\n- 想法：\n- 评估：\n- 下一步：\n",
    "en": "## Brainstorm - {topic}\n- Ideas:\n- Assessment:\n- Next steps:\n"
  },
  "profession": ["general"],
  "tags": ["ideation", "brainstorm"],
  "enabled": true
}
```

- [ ] **Step 4: 创建 requirement.json**

`resources/slash/requirement.json`：

```json
{
  "id": "requirement",
  "version": "1.0.0",
  "title": { "zh": "用户需求", "en": "User Requirement" },
  "description": { "zh": "插入用户需求框架", "en": "Insert user requirement skeleton" },
  "icon": "push_pin",
  "markdown": {
    "zh": "- 需求：\n- 用户故事：作为一名{角色}，我希望{功能}，以便{价值}\n- 优先级：P0/P1/P2\n",
    "en": "- Requirement:\n- User story: As a {role}, I want {feature}, so that {value}\n- Priority: P0/P1/P2\n"
  },
  "profession": ["pm"],
  "tags": ["requirement", "pm"],
  "enabled": true
}
```

- [ ] **Step 5: 创建 interview.json**

`resources/slash/interview.json`：

```json
{
  "id": "interview",
  "version": "1.0.0",
  "title": { "zh": "用户访谈", "en": "User Interview" },
  "description": { "zh": "插入用户访谈框架", "en": "Insert user interview skeleton" },
  "icon": "forum",
  "markdown": {
    "zh": "## 用户访谈 - {对象}\n- 背景：\n- 原话：\n- 痛点：\n",
    "en": "## User Interview - {subject}\n- Background:\n- Quotes:\n- Pain points:\n"
  },
  "profession": ["pm"],
  "tags": ["research", "interview"],
  "enabled": true
}
```

- [ ] **Step 6: 创建 competitor.json**

`resources/slash/competitor.json`：

```json
{
  "id": "competitor",
  "version": "1.0.0",
  "title": { "zh": "竞品观察", "en": "Competitor Observation" },
  "description": { "zh": "插入竞品观察框架", "en": "Insert competitor observation skeleton" },
  "icon": "manage_search",
  "markdown": {
    "zh": "## 竞品观察 - {竞品名}\n- 动态：\n- 影响：\n",
    "en": "## Competitor Observation - {product}\n- Update:\n- Impact:\n"
  },
  "profession": ["pm"],
  "tags": ["research", "competitor"],
  "enabled": true
}
```

- [ ] **Step 7: 创建 data.json**

`resources/slash/data.json`：

```json
{
  "id": "data",
  "version": "1.0.0",
  "title": { "zh": "产品数据", "en": "Product Data" },
  "description": { "zh": "插入产品数据框架", "en": "Insert product data skeleton" },
  "icon": "insights",
  "markdown": {
    "zh": "- 指标：{} 数值：{} 同比：\n- 假设：\n- 验证：\n",
    "en": "- Metric: {} Value: {} YoY:\n- Hypothesis:\n- Validation:\n"
  },
  "profession": ["pm"],
  "tags": ["data", "metric"],
  "enabled": true
}
```

- [ ] **Step 8: 创建 meeting.json**

`resources/slash/meeting.json`：

```json
{
  "id": "meeting",
  "version": "1.0.0",
  "title": { "zh": "会议纪要", "en": "Meeting Notes" },
  "description": { "zh": "插入会议纪要框架", "en": "Insert meeting notes skeleton" },
  "icon": "edit_note",
  "markdown": {
    "zh": "## 会议纪要 - {标题}\n- 时间：\n- 参会：\n- 决策：\n- 行动项：\n",
    "en": "## Meeting Notes - {title}\n- Time:\n- Attendees:\n- Decisions:\n- Action items:\n"
  },
  "profession": ["pm"],
  "tags": ["meeting", "notes"],
  "enabled": true
}
```

- [ ] **Step 9: 创建 plan.json**

`resources/slash/plan.json`：

```json
{
  "id": "plan",
  "version": "1.0.0",
  "title": { "zh": "工作计划", "en": "Work Plan" },
  "description": { "zh": "插入工作计划框架", "en": "Insert work plan skeleton" },
  "icon": "calendar_month",
  "markdown": {
    "zh": "## 工作计划 - {主题}\n- 周期：{起止时间}\n- 目标：\n- 任务：\n  - [ ] {任务1}\n  - [ ] {任务2}\n- 风险与依赖：\n",
    "en": "## Work Plan - {topic}\n- Period: {start–end}\n- Goals:\n- Tasks:\n  - [ ] {task 1}\n  - [ ] {task 2}\n- Risks & dependencies:\n"
  },
  "profession": ["pm"],
  "tags": ["plan", "work"],
  "enabled": true
}
```

- [ ] **Step 10: 创建 tech-design.json**

`resources/slash/tech-design.json`：

```json
{
  "id": "tech-design",
  "version": "1.0.0",
  "title": { "zh": "技术方案", "en": "Technical Design" },
  "description": { "zh": "插入技术方案框架", "en": "Insert technical design skeleton" },
  "icon": "extension",
  "markdown": {
    "zh": "## 技术方案 - {主题}\n- 背景与目标：\n- 方案对比：\n- 选型理由：\n- 架构图：\n- 风险与回滚：\n",
    "en": "## Technical Design - {topic}\n- Background & goals:\n- Options compared:\n- Decision rationale:\n- Architecture:\n- Risks & rollback:\n"
  },
  "profession": ["developer"],
  "tags": ["tech", "design"],
  "enabled": true
}
```

- [ ] **Step 11: 创建 article.json**

`resources/slash/article.json`：

```json
{
  "id": "article",
  "version": "1.0.0",
  "title": { "zh": "文章大纲", "en": "Article Outline" },
  "description": { "zh": "插入文章大纲框架", "en": "Insert article outline skeleton" },
  "icon": "edit",
  "markdown": {
    "zh": "## 文章大纲 - {主题}\n- 核心观点：\n- 读者对象：\n- 结构：\n  - 引言：\n  - 正文要点：\n  - 结论：\n- 素材/引用：\n",
    "en": "## Article Outline - {topic}\n- Core thesis:\n- Target readers:\n- Structure:\n  - Intro:\n  - Key points:\n  - Conclusion:\n- Materials/citations:\n"
  },
  "profession": ["writer"],
  "tags": ["writing", "outline"],
  "enabled": true
}
```

- [ ] **Step 12: 创建 story.json**

`resources/slash/story.json`：

```json
{
  "id": "story",
  "version": "1.0.0",
  "title": { "zh": "故事梗概", "en": "Story Outline" },
  "description": { "zh": "插入故事梗概框架", "en": "Insert story outline skeleton" },
  "icon": "auto_stories",
  "markdown": {
    "zh": "## 故事梗概 - {标题}\n- 人物：\n- 设定：\n- 冲突：\n- 情节推进：\n- 结局：\n",
    "en": "## Story Outline - {title}\n- Characters:\n- Setting:\n- Conflict:\n- Plot progression:\n- Ending:\n"
  },
  "profession": ["writer"],
  "tags": ["writing", "story"],
  "enabled": true
}
```

- [ ] **Step 13: 创建 idea.json**

`resources/slash/idea.json`：

```json
{
  "id": "idea",
  "version": "1.0.0",
  "title": { "zh": "灵感记录", "en": "Idea Capture" },
  "description": { "zh": "插入灵感记录框架", "en": "Insert idea capture skeleton" },
  "icon": "lightbulb",
  "markdown": {
    "zh": "## 灵感记录 - {主题}\n- 触发点：\n- 想法：\n- 可能的发展方向：\n",
    "en": "## Idea Capture - {topic}\n- Trigger:\n- Idea:\n- Possible directions:\n"
  },
  "profession": ["writer"],
  "tags": ["ideation", "idea"],
  "enabled": true
}
```

- [ ] **Step 14: 创建 class-notes.json**

`resources/slash/class-notes.json`：

```json
{
  "id": "class-notes",
  "version": "1.0.0",
  "title": { "zh": "课堂笔记", "en": "Class Notes" },
  "description": { "zh": "插入课堂笔记框架", "en": "Insert class notes skeleton" },
  "icon": "school",
  "markdown": {
    "zh": "## 课堂笔记 - {课程}\n- 日期：\n- 知识点：\n- 例子：\n- 疑问：\n",
    "en": "## Class Notes - {course}\n- Date:\n- Key points:\n- Examples:\n- Questions:\n"
  },
  "profession": ["student"],
  "tags": ["study", "notes"],
  "enabled": true
}
```

- [ ] **Step 15: 创建 review-outline.json**

`resources/slash/review-outline.json`：

```json
{
  "id": "review-outline",
  "version": "1.0.0",
  "title": { "zh": "复习提纲", "en": "Study Outline" },
  "description": { "zh": "插入复习提纲框架", "en": "Insert study outline skeleton" },
  "icon": "library_books",
  "markdown": {
    "zh": "## 复习提纲 - {科目}\n- 章节：\n- 重点概念：\n- 公式/定义：\n- 易错点：\n- 自测题：\n",
    "en": "## Study Outline - {subject}\n- Chapters:\n- Key concepts:\n- Formulas/definitions:\n- Common mistakes:\n- Practice questions:\n"
  },
  "profession": ["student"],
  "tags": ["study", "review"],
  "enabled": true
}
```

- [ ] **Step 16: 创建 reading-notes.json**

`resources/slash/reading-notes.json`：

```json
{
  "id": "reading-notes",
  "version": "1.0.0",
  "title": { "zh": "读书笔记", "en": "Reading Notes" },
  "description": { "zh": "插入读书笔记框架", "en": "Insert reading notes skeleton" },
  "icon": "menu_book",
  "markdown": {
    "zh": "## 读书笔记 - {书名}\n- 作者：\n- 核心内容：\n- 金句摘录：\n- 我的思考：\n",
    "en": "## Reading Notes - {book}\n- Author:\n- Core content:\n- Quotes:\n- My thoughts:\n"
  },
  "profession": ["student"],
  "tags": ["study", "reading"],
  "enabled": true
}
```

- [ ] **Step 17: 创建 literature.json**

`resources/slash/literature.json`：

```json
{
  "id": "literature",
  "version": "1.0.0",
  "title": { "zh": "文献笔记", "en": "Literature Note" },
  "description": { "zh": "插入文献阅读笔记框架", "en": "Insert literature note skeleton" },
  "icon": "science",
  "markdown": {
    "zh": "## 文献笔记 - {标题}\n- 作者/年份：\n- 核心观点：\n- 方法：\n- 结论：\n- 与我的研究的关系：\n",
    "en": "## Literature Note - {title}\n- Author/Year:\n- Core argument:\n- Method:\n- Findings:\n- Relevance to my research:\n"
  },
  "profession": ["researcher"],
  "tags": ["research", "literature"],
  "enabled": true
}
```

- [ ] **Step 18: 创建 experiment.json**

`resources/slash/experiment.json`：

```json
{
  "id": "experiment",
  "version": "1.0.0",
  "title": { "zh": "实验记录", "en": "Experiment Log" },
  "description": { "zh": "插入实验记录框架", "en": "Insert experiment log skeleton" },
  "icon": "biotech",
  "markdown": {
    "zh": "## 实验记录 - {实验名}\n- 假设：\n- 方法：\n- 变量：\n- 结果：\n- 结论：\n",
    "en": "## Experiment Log - {experiment}\n- Hypothesis:\n- Method:\n- Variables:\n- Results:\n- Conclusion:\n"
  },
  "profession": ["researcher"],
  "tags": ["research", "experiment"],
  "enabled": true
}
```

- [ ] **Step 19: 验证 18 个文件已创建**

Run: `node -e "const fs=require('fs');console.log('count:',fs.readdirSync('resources/slash').filter(f=>f.endsWith('.json')).length)"`
Expected: count: 18

- [ ] **Step 20: 提交**

```bash
git add resources/slash/
git commit -m "feat(resource): migrate 18 slash builtin templates to JSON files"
```

---

### Task 6: 迁移 page 内置模板为 JSON 文件

**Files:**
- Create: 5 个 `resources/page/*.json` 文件

**说明：** 数据来源为 `src/renderer/templates/builtin-page-templates.ts`。markdown 换行用 `\n` 转义。

- [ ] **Step 1: 创建 page-prd.json**

`resources/page/page-prd.json`（markdown 较长，从原 `builtinPageTemplates` 中提取）：

```json
{
  "id": "page-prd",
  "version": "1.0.0",
  "title": { "zh": "产品需求说明书", "en": "Product Requirements Document" },
  "description": { "zh": "标准 PRD 文档骨架", "en": "Standard PRD document skeleton" },
  "icon": "fact_check",
  "markdown": {
    "zh": "# 产品需求说明书（PRD）\n\n## 文档信息\n\n- 产品名称：{产品名称}\n- 作者：{姓名}\n- 日期：{日期}\n- 版本：v0.1\n\n## 背景与目标\n\n### 背景\n\n### 目标\n\n### 非目标\n\n## 用户与场景\n\n- 目标用户：\n- 核心场景：\n\n## 功能需求\n\n| 编号 | 功能 | 优先级 | 描述 |\n| --- | --- | --- | --- |\n| F1 |  | P0 |  |\n\n### 功能详情：F1 {功能名称}\n\n- 用户故事：作为{角色}，我希望{功能}，以便{价值}\n- 交互流程：\n- 边界条件：\n\n## 非功能需求\n\n- 性能：\n- 兼容性：\n- 安全：\n\n## 里程碑\n\n| 阶段 | 内容 | 时间 |\n| --- | --- | --- |\n|  |  |  |\n\n## 开放问题\n\n- [ ] \n",
    "en": "# Product Requirements Document (PRD)\n\n## Document Info\n\n- Product: {product name}\n- Author: {name}\n- Date: {date}\n- Version: v0.1\n\n## Background & Goals\n\n### Background\n\n### Goals\n\n### Non-Goals\n\n## Users & Scenarios\n\n- Target users:\n- Key scenarios:\n\n## Functional Requirements\n\n| ID | Feature | Priority | Description |\n| --- | --- | --- | --- |\n| F1 |  | P0 |  |\n\n### Feature Detail: F1 {feature name}\n\n- User story: As a {role}, I want {feature}, so that {value}\n- Interaction flow:\n- Edge cases:\n\n## Non-Functional Requirements\n\n- Performance:\n- Compatibility:\n- Security:\n\n## Milestones\n\n| Phase | Scope | Date |\n| --- | --- | --- |\n|  |  |  |\n\n## Open Questions\n\n- [ ] \n"
  },
  "profession": ["pm"],
  "tags": ["document", "prd"],
  "enabled": true
}
```

- [ ] **Step 2: 创建 page-tech-design.json**

`resources/page/page-tech-design.json`：

```json
{
  "id": "page-tech-design",
  "version": "1.0.0",
  "title": { "zh": "技术设计文档", "en": "Technical Design Document" },
  "description": { "zh": "技术方案与接口设计骨架", "en": "Technical solution and API design skeleton" },
  "icon": "code",
  "markdown": {
    "zh": "# 技术设计文档\n\n## 背景与目标\n\n- 需求：\n- 目标：\n\n## 总体方案\n\n- 方案概述：\n- 备选方案对比：\n\n## 详细设计\n\n### 模块划分\n\n### 数据结构\n\n### 接口设计\n\n| 接口 | 方法 | 入参 | 出参 | 说明 |\n| --- | --- | --- | --- | --- |\n|  |  |  |  |  |\n\n### 关键流程\n\n## 异常与兼容\n\n- 异常处理：\n- 兼容性：\n\n## 测试计划\n\n- [ ] 单元测试：\n- [ ] 集成测试：\n\n## 上线计划\n",
    "en": "# Technical Design Document\n\n## Background & Goals\n\n- Requirement:\n- Goals:\n\n## Overall Solution\n\n- Summary:\n- Alternatives:\n\n## Detailed Design\n\n### Modules\n\n### Data Structures\n\n### API Design\n\n| API | Method | Input | Output | Notes |\n| --- | --- | --- | --- | --- |\n|  |  |  |  |  |\n\n### Key Flows\n\n## Errors & Compatibility\n\n- Error handling:\n- Compatibility:\n\n## Test Plan\n\n- [ ] Unit tests:\n- [ ] Integration tests:\n\n## Release Plan\n"
  },
  "profession": ["developer"],
  "tags": ["document", "tech-design"],
  "enabled": true
}
```

- [ ] **Step 3: 创建 page-weekly-report.json**

`resources/page/page-weekly-report.json`：

```json
{
  "id": "page-weekly-report",
  "version": "1.0.0",
  "title": { "zh": "项目周报", "en": "Weekly Report" },
  "description": { "zh": "周进展与风险汇报骨架", "en": "Weekly progress and risk report skeleton" },
  "icon": "summarize",
  "markdown": {
    "zh": "# 项目周报\n\n- 周期：{起始日期} ~ {结束日期}\n- 汇报人：\n\n## 本周进展\n\n| 事项 | 状态 | 说明 |\n| --- | --- | --- |\n|  | 进行中 |  |\n\n## 数据与指标\n\n## 问题与风险\n\n- 风险：\n- 需要的支持：\n\n## 下周计划\n\n- [ ] \n\n## 备注\n",
    "en": "# Weekly Report\n\n- Period: {start date} ~ {end date}\n- Reporter:\n\n## Progress This Week\n\n| Item | Status | Notes |\n| --- | --- | --- |\n|  | In progress |  |\n\n## Metrics\n\n## Issues & Risks\n\n- Risks:\n- Support needed:\n\n## Plan for Next Week\n\n- [ ] \n\n## Notes\n"
  },
  "profession": ["general"],
  "tags": ["report", "weekly"],
  "enabled": true
}
```

- [ ] **Step 4: 创建 page-reading-notes.json**

`resources/page/page-reading-notes.json`：

```json
{
  "id": "page-reading-notes",
  "version": "1.0.0",
  "title": { "zh": "阅读笔记", "en": "Reading Notes" },
  "description": { "zh": "书籍阅读记录与摘录骨架", "en": "Book notes with excerpts skeleton" },
  "icon": "note_alt",
  "markdown": {
    "zh": "# 阅读笔记：《{书名}》\n\n- 作者：\n- 阅读日期：\n- 评分：⭐⭐⭐⭐⭐\n\n## 一句话总结\n\n## 核心观点\n\n1. \n2. \n3. \n\n## 摘录与批注\n\n> {原文摘录}\n\n批注：\n\n## 读后感\n\n## 行动清单\n\n- [ ] \n",
    "en": "# Reading Notes: {Book Title}\n\n- Author:\n- Date:\n- Rating: ⭐⭐⭐⭐⭐\n\n## One-Sentence Summary\n\n## Key Ideas\n\n1. \n2. \n3. \n\n## Excerpts & Comments\n\n> {excerpt}\n\nComment:\n\n## Reflections\n\n## Action Items\n\n- [ ] \n"
  },
  "profession": ["general"],
  "tags": ["note", "reading"],
  "enabled": true
}
```

- [ ] **Step 5: 创建 page-project-plan.json**

`resources/page/page-project-plan.json`：

```json
{
  "id": "page-project-plan",
  "version": "1.0.0",
  "title": { "zh": "项目计划书", "en": "Project Plan" },
  "description": { "zh": "项目目标、里程碑与分工骨架", "en": "Project goals, milestones and staffing skeleton" },
  "icon": "task_alt",
  "markdown": {
    "zh": "# 项目计划书\n\n## 项目概述\n\n- 项目名称：\n- 项目目标：\n- 关键成功指标：\n\n## 范围\n\n- 包含：\n- 不包含：\n\n## 里程碑计划\n\n| 里程碑 | 交付物 | 截止日期 | 负责人 |\n| --- | --- | --- | --- |\n| M1 |  |  |  |\n\n## 资源与分工\n\n| 成员 | 职责 |\n| --- | --- |\n|  |  |\n\n## 风险与应对\n\n| 风险 | 影响 | 应对措施 |\n| --- | --- | --- |\n|  |  |  |\n\n## 沟通机制\n\n- 周会：\n- 文档：\n",
    "en": "# Project Plan\n\n## Overview\n\n- Project name:\n- Goals:\n- Key success metrics:\n\n## Scope\n\n- In scope:\n- Out of scope:\n\n## Milestones\n\n| Milestone | Deliverable | Due Date | Owner |\n| --- | --- | --- | --- |\n| M1 |  |  |  |\n\n## Team & Responsibilities\n\n| Member | Responsibility |\n| --- | --- |\n|  |  |\n\n## Risks & Mitigation\n\n| Risk | Impact | Mitigation |\n| --- | --- | --- |\n|  |  |  |\n\n## Communication\n\n- Weekly meeting:\n- Documentation:\n"
  },
  "profession": ["pm"],
  "tags": ["plan", "project"],
  "enabled": true
}
```

- [ ] **Step 6: 验证 5 个文件已创建**

Run: `node -e "console.log('count:',require('fs').readdirSync('resources/page').filter(f=>f.endsWith('.json')).length)"`
Expected: count: 5

- [ ] **Step 7: 提交**

```bash
git add resources/page/
git commit -m "feat(resource): migrate 5 page builtin templates to JSON files"
```

---

### Task 7: 移动 skill 文件到 resources/skills/ 顶层

**Files:**
- Move: `resources/skills/built-in/*` → `resources/skills/*`
- Delete: `resources/skills/built-in/`

- [ ] **Step 1: 列出现有文件**

Run: `node -e "console.log(require('fs').readdirSync('resources/skills/built-in').join('\n'))"`
Expected: 12 个文件（11 个 .skill.json + skill.schema.json）

- [ ] **Step 2: 执行移动**

Run: `node -e "const fs=require('fs'),path=require('path');const src='resources/skills/built-in',dest='resources/skills';fs.readdirSync(src).forEach(f=>{fs.renameSync(path.join(src,f),path.join(dest,f));console.log('moved:',f)});fs.rmdirSync(src);console.log('built-in dir removed')"`

- [ ] **Step 3: 验证**

Run: `node -e "const fs=require('fs');console.log('count:',fs.readdirSync('resources/skills').length);console.log('built-in exists:',fs.existsSync('resources/skills/built-in'))"`
Expected: count: 12，built-in exists: false

- [ ] **Step 4: 提交**

```bash
git add resources/skills/ resources/skills/built-in/
git commit -m "refactor(resource): flatten skills/built-in/ to skills/ for unified storage"
```

---

### Task 8: 生成 manifest.json

**Files:**
- Create: `scripts/generate-manifest.mjs`
- Create: `resources/manifest.json`

- [ ] **Step 1: 创建生成脚本**

`scripts/generate-manifest.mjs`：

```js
/**
 * 生成 resources/manifest.json
 * 用法: node scripts/generate-manifest.mjs
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resourcesDir = path.resolve(__dirname, "..", "resources");
const manifestPath = path.join(resourcesDir, "manifest.json");

function typeFromPath(relPath) {
  const top = relPath.split("/")[0];
  if (top === "slash") return "slash";
  if (top === "page") return "page";
  if (top === "skills") return "skill";
  throw new Error(`无法识别的资源类型: ${relPath}`);
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function readVersion(filePath) {
  const c = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  if (typeof c.version !== "string") throw new Error(`缺少 version: ${filePath}`);
  return c.version;
}

function walk(dir, base = "") {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (fs.statSync(abs).isDirectory()) out.push(...walk(abs, rel));
    else if (name.endsWith(".json") && name !== "manifest.json" && name !== "skill.schema.json")
      out.push({ absPath: abs, relPath: rel });
  }
  return out;
}

const entries = walk(resourcesDir)
  .map(({ absPath, relPath }) => ({
    type: typeFromPath(relPath),
    path: relPath.replace(/\\/g, "/"),
    version: readVersion(absPath),
    sha256: sha256(absPath),
  }))
  .sort((a, b) => a.path.localeCompare(b.path));

const manifest = { version: "1.0.0", updatedAt: new Date().toISOString(), files: entries };
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
console.log(`Generated manifest.json with ${entries.length} entries`);
```

- [ ] **Step 2: 运行生成脚本**

Run: `node scripts/generate-manifest.mjs`
Expected: `Generated manifest.json with 34 entries`（18 slash + 5 page + 11 skill）

- [ ] **Step 3: 验证**

Run: `node -e "const m=require('./resources/manifest.json');const byType={};m.files.forEach(f=>byType[f.type]=(byType[f.type]||0)+1);console.log('files:',m.files.length,'byType:',byType)"`
Expected: files: 34，byType: { slash: 18, page: 5, skill: 11 }

- [ ] **Step 4: 提交**

```bash
git add scripts/generate-manifest.mjs resources/manifest.json
git commit -m "feat(resource): generate manifest.json with 34 file entries"
```

---

## Phase 3: Manifest 模型 + 测试

### Task 9: 实现 ResourceManifest 模型

**Files:**
- Create: `src/main/core/services/resource-manifest.ts`
- Test: `tests/unit/main/resource-manifest.test.ts`

- [ ] **Step 1: 写失败测试**

`tests/unit/main/resource-manifest.test.ts`：

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  parseManifest,
  computeFileHash,
  compareManifests,
} from "@/main/core/services/resource-manifest";
import type { RemoteManifest, LocalManifest } from "@/shared/types/resource.types";

const entry = (path: string, version: string, sha256: string) => ({
  type: "slash" as const, path, version, sha256,
});

describe("parseManifest", () => {
  it("合法 JSON 返回对象", () => {
    const r = parseManifest(JSON.stringify({
      version: "1.0.0", updatedAt: "2026-08-31T10:00:00Z",
      files: [entry("slash/a.json", "1.0.0", "abc")],
    }));
    expect(r).not.toBeNull();
    expect(r!.files).toHaveLength(1);
  });
  it("非法 JSON 返回 null", () => {
    expect(parseManifest("bad")).toBeNull();
  });
  it("缺少 files 返回 null", () => {
    expect(parseManifest(JSON.stringify({ version: "1.0.0" }))).toBeNull();
  });
});

describe("computeFileHash", () => {
  it("相同内容相同 hash", () => {
    expect(computeFileHash("hello")).toBe(computeFileHash("hello"));
  });
  it("返回 64 字符 hex", () => {
    expect(computeFileHash("test")).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("compareManifests", () => {
  const remote: RemoteManifest = {
    version: "1.0.0", updatedAt: "2026-08-31T10:00:00Z",
    files: [
      entry("a.json", "1.0.0", "ha"),
      entry("b.json", "1.0.0", "hb2"),
      entry("c.json", "1.0.0", "hc"),
    ],
  };
  it("local null 时全部 toAdd", () => {
    const d = compareManifests(null, remote);
    expect(d.toAdd).toHaveLength(3);
    expect(d.toUpdate).toHaveLength(0);
    expect(d.toRemove).toHaveLength(0);
  });
  it("version 不一致 → toUpdate", () => {
    const local: LocalManifest = {
      version: "0.9.0", updatedAt: "",
      files: [entry("a.json", "0.9.0", "ha"), entry("b.json", "1.0.0", "hb1")],
    };
    const d = compareManifests(local, remote);
    expect(d.toAdd[0].path).toBe("c.json");
    expect(d.toUpdate[0].path).toBe("b.json");
  });
  it("sha256 不一致 → toUpdate", () => {
    const local: LocalManifest = {
      version: "1.0.0", updatedAt: "",
      files: [entry("a.json", "1.0.0", "different")],
    };
    const d = compareManifests(local, remote);
    expect(d.toUpdate[0].path).toBe("a.json");
  });
  it("本地多余 → toRemove", () => {
    const local: LocalManifest = {
      version: "1.0.0", updatedAt: "",
      files: [entry("a.json", "1.0.0", "ha"), entry("old.json", "0.8", "ho")],
    };
    const d = compareManifests(local, remote);
    expect(d.toRemove).toEqual(["old.json"]);
  });
  it("完全一致时空", () => {
    const d = compareManifests(JSON.parse(JSON.stringify(remote)), remote);
    expect(d.toAdd).toHaveLength(0);
    expect(d.toUpdate).toHaveLength(0);
    expect(d.toRemove).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test tests/unit/main/resource-manifest.test.ts`
Expected: FAIL，模块找不到

- [ ] **Step 3: 实现**

`src/main/core/services/resource-manifest.ts`：

```ts
import { createHash } from "crypto";
import type {
  RemoteManifest, LocalManifest, ManifestEntry,
} from "@/shared/types/resource.types";

export interface ManifestDiff {
  toAdd: ManifestEntry[];
  toUpdate: ManifestEntry[];
  toRemove: string[];
}

export function parseManifest(json: string): RemoteManifest | null {
  try {
    const p = JSON.parse(json) as unknown;
    if (typeof p !== "object" || p === null) return null;
    const o = p as Record<string, unknown>;
    if (typeof o.version !== "string") return null;
    if (typeof o.updatedAt !== "string") return null;
    if (!Array.isArray(o.files)) return null;
    const files: ManifestEntry[] = [];
    for (const f of o.files) {
      if (!f || typeof f !== "object") return null;
      const e = f as Record<string, unknown>;
      if (typeof e.type !== "string") return null;
      if (typeof e.path !== "string") return null;
      if (typeof e.version !== "string") return null;
      if (typeof e.sha256 !== "string") return null;
      files.push({
        type: e.type as ManifestEntry["type"],
        path: e.path, version: e.version, sha256: e.sha256,
      });
    }
    return { version: o.version, updatedAt: o.updatedAt, files };
  } catch { return null; }
}

export function computeFileHash(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

export function compareManifests(
  local: LocalManifest | null, remote: RemoteManifest,
): ManifestDiff {
  const remoteMap = new Map(remote.files.map((f) => [f.path, f]));
  if (!local) return { toAdd: [...remote.files], toUpdate: [], toRemove: [] };
  const localMap = new Map(local.files.map((f) => [f.path, f]));
  const toAdd: ManifestEntry[] = [];
  const toUpdate: ManifestEntry[] = [];
  const toRemove: string[] = [];
  for (const [path, r] of remoteMap) {
    const l = localMap.get(path);
    if (!l) toAdd.push(r);
    else if (l.version !== r.version || l.sha256 !== r.sha256) toUpdate.push(r);
  }
  for (const path of localMap.keys()) if (!remoteMap.has(path)) toRemove.push(path);
  return { toAdd, toUpdate, toRemove };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm test tests/unit/main/resource-manifest.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/main/core/services/resource-manifest.ts tests/unit/main/resource-manifest.test.ts
git commit -m "feat(resource): implement manifest parser and diff logic"
```

---

## Phase 4: HTTP 客户端 + 测试

### Task 10: 实现 ResourceHttpClient

**Files:**
- Create: `src/main/core/services/resource-http.client.ts`
- Test: `tests/unit/main/resource-http.client.test.ts`

- [ ] **Step 1: 写失败测试**

`tests/unit/main/resource-http.client.test.ts`：

```ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof global.fetch;
const sleepMock = vi.spyOn(global, "setTimeout");

import { resourceHttpClient } from "@/main/core/services/resource-http.client";

describe("ResourceHttpClient", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    sleepMock.mockReset();
    sleepMock.mockImplementation((cb: () => void) => { cb(); return 0 as unknown as NodeJS.Timeout; });
  });
  afterEach(() => sleepMock.mockRestore());

  it("成功返回 text", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => "hello" } as Response);
    const r = await resourceHttpClient.fetchText("https://example.com/a.json");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.text).toBe("hello");
  });
  it("HTTP 404 失败", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, text: async () => "" } as Response);
    const r = await resourceHttpClient.fetchText("https://example.com/x.json");
    expect(r.ok).toBe(false);
  });
  it("网络错误重试 3 次", async () => {
    fetchMock.mockRejectedValue(new Error("network error"));
    const r = await resourceHttpClient.fetchText("https://example.com/a.json");
    expect(r.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("首次失败重试成功", async () => {
    fetchMock.mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "ok" } as Response);
    const r = await resourceHttpClient.fetchText("https://example.com/a.json");
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test tests/unit/main/resource-http.client.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

`src/main/core/services/resource-http.client.ts`：

```ts
import { RESOURCE_CONFIG } from "@/main/constants/resource.constants";
import { Logger } from "@/main/utils/logger";

export type FetchResult = { ok: true; text: string } | { ok: false; error: string };

class ResourceHttpClient {
  private static instance: ResourceHttpClient | null = null;
  private constructor() {}
  public static getInstance(): ResourceHttpClient {
    if (!ResourceHttpClient.instance) ResourceHttpClient.instance = new ResourceHttpClient();
    return ResourceHttpClient.instance;
  }
  private sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

  async fetchText(url: string): Promise<FetchResult> {
    const maxAttempts = RESOURCE_CONFIG.maxRetries + 1;
    let lastError = "";
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), RESOURCE_CONFIG.requestTimeout);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) {
          lastError = `HTTP ${res.status} ${res.statusText}`;
          Logger.warn("Resource fetch non-2xx", { url, status: res.status, attempt });
        } else {
          return { ok: true, text: await res.text() };
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        Logger.warn("Resource fetch error", { url, error: lastError, attempt });
      }
      if (attempt < maxAttempts) await this.sleep(RESOURCE_CONFIG.retryDelayMs);
    }
    return { ok: false, error: lastError };
  }
}

export const resourceHttpClient = ResourceHttpClient.getInstance();
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm test tests/unit/main/resource-http.client.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/main/core/services/resource-http.client.ts tests/unit/main/resource-http.client.test.ts
git commit -m "feat(resource): implement HTTP client with retry and timeout"
```

---

## Phase 5: 同步服务 + 测试

### Task 11: 实现 ResourceSyncService

**Files:**
- Create: `src/main/core/services/resource-sync.service.ts`
- Test: `tests/unit/main/resource-sync.service.test.ts`

- [ ] **Step 1: 写失败测试**

`tests/unit/main/resource-sync.service.test.ts`：

```ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/main/utils/logger", () => ({ Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() } }));
const mockGetWorkspace = vi.hoisted(() => vi.fn(() => "/tmp/wrisp-test-ws"));
vi.mock("@/main/core/services/config.service", () => ({ configService: { getValue: mockGetWorkspace } }));
const mockFetchText = vi.hoisted(() => vi.fn());
vi.mock("@/main/core/services/resource-http.client", () => ({ resourceHttpClient: { fetchText: mockFetchText } }));
const mockParse = vi.hoisted(() => vi.fn());
const mockCompare = vi.hoisted(() => vi.fn());
const mockHash = vi.hoisted(() => vi.fn(() => "fake-hash"));
vi.mock("@/main/core/services/resource-manifest", () => ({ parseManifest: mockParse, compareManifests: mockCompare, computeFileHash: mockHash }));
vi.mock("electron", () => ({ app: { getPath: vi.fn() }, BrowserWindow: { getAllWindows: vi.fn(() => []) } }));
const mockFs = vi.hoisted(() => ({ existsSync: vi.fn(() => false), mkdirSync: vi.fn(), readFileSync: vi.fn(), writeFileSync: vi.fn(), unlinkSync: vi.fn() }));
vi.mock("fs", () => ({ default: mockFs, __esModule: true }));

import { resourceSyncService } from "@/main/core/services/resource-sync.service";
import type { RemoteManifest } from "@/shared/types/resource.types";

describe("ResourceSyncService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWorkspace.mockReturnValue("/tmp/wrisp-test-ws");
    mockFs.existsSync.mockReturnValue(false);
  });

  it("初始状态 syncing=false", () => {
    expect(resourceSyncService.getStatus().syncing).toBe(false);
  });
  it("manifest 拉取失败返回失败", async () => {
    mockFetchText.mockResolvedValueOnce({ ok: false, error: "net" });
    const r = await resourceSyncService.checkAndSync();
    expect(r.success).toBe(false);
  });
  it("manifest 解析失败返回失败", async () => {
    mockFetchText.mockResolvedValueOnce({ ok: true, text: "bad" });
    mockParse.mockReturnValueOnce(null);
    const r = await resourceSyncService.checkAndSync();
    expect(r.success).toBe(false);
  });
  it("全量下载成功", async () => {
    const remote: RemoteManifest = {
      version: "1.0.0", updatedAt: "2026-08-31T10:00:00Z",
      files: [
        { type: "slash", path: "slash/a.json", version: "1.0.0", sha256: "h1" },
        { type: "page", path: "page/b.json", version: "1.0.0", sha256: "h2" },
      ],
    };
    mockFetchText.mockResolvedValueOnce({ ok: true, text: "manifest" })
      .mockResolvedValueOnce({ ok: true, text: "a" })
      .mockResolvedValueOnce({ ok: true, text: "b" });
    mockParse.mockReturnValueOnce(remote);
    mockCompare.mockReturnValueOnce({ toAdd: remote.files, toUpdate: [], toRemove: [] });
    mockHash.mockReturnValue("h1").mockReturnValue("h2");
    mockFs.existsSync.mockReturnValue(false);
    const r = await resourceSyncService.checkAndSync();
    expect(r.success).toBe(true);
    expect(r.added).toHaveLength(2);
    expect(r.changedTypes).toContain("slash");
  });
  it("部分下载失败跳过", async () => {
    const remote: RemoteManifest = {
      version: "1.0.0", updatedAt: "",
      files: [
        { type: "slash", path: "slash/a.json", version: "1.0.0", sha256: "h1" },
        { type: "slash", path: "slash/b.json", version: "1.0.0", sha256: "h2" },
      ],
    };
    mockFetchText.mockResolvedValueOnce({ ok: true, text: "manifest" })
      .mockResolvedValueOnce({ ok: true, text: "a" })
      .mockResolvedValueOnce({ ok: false, error: "404" });
    mockParse.mockReturnValueOnce(remote);
    mockCompare.mockReturnValueOnce({ toAdd: remote.files, toUpdate: [], toRemove: [] });
    mockHash.mockReturnValue("h1");
    const r = await resourceSyncService.checkAndSync();
    expect(r.success).toBe(true);
    expect(r.added).toEqual(["slash/a.json"]);
  });
  it("无变更 changedTypes 空", async () => {
    mockFetchText.mockResolvedValueOnce({ ok: true, text: "manifest" });
    mockParse.mockReturnValueOnce({ version: "1.0.0", updatedAt: "", files: [] });
    mockCompare.mockReturnValueOnce({ toAdd: [], toUpdate: [], toRemove: [] });
    const r = await resourceSyncService.checkAndSync();
    expect(r.changedTypes).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test tests/unit/main/resource-sync.service.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

`src/main/core/services/resource-sync.service.ts`：

```ts
import * as fs from "fs";
import * as path from "path";
import { BrowserWindow } from "electron";
import { configService } from "@/main/core/services/config.service";
import { resourceHttpClient } from "@/main/core/services/resource-http.client";
import { parseManifest, compareManifests, computeFileHash } from "@/main/core/services/resource-manifest";
import { RESOURCE_REPO, RESOURCE_CONFIG } from "@/main/constants/resource.constants";
import { RESOURCES_DIR } from "@/main/constants/folder.constants";
import { Logger } from "@/main/utils/logger";
import type { RemoteManifest, LocalManifest, SyncStatus, SyncResult } from "@/shared/types/resource.types";
import type { ResourceType } from "@/shared/enums/resource.enums";
import { EMPTY_SYNC_STATUS } from "@/shared/types/resource.types";

class ResourceSyncService {
  private static instance: ResourceSyncService | null = null;
  private status: SyncStatus = { ...EMPTY_SYNC_STATUS };
  private constructor() {}
  public static getInstance(): ResourceSyncService {
    if (!ResourceSyncService.instance) ResourceSyncService.instance = new ResourceSyncService();
    return ResourceSyncService.instance;
  }

  public getStatus(): SyncStatus { return { ...this.status }; }

  private getWorkspaceResourcesDir(): string {
    const ws = (globalThis as Record<string, unknown>).__WRISP_WORKSPACE_PATH__ as string | undefined
      || configService.getValue<string>("workspace") || "";
    return path.join(ws, RESOURCES_DIR);
  }
  private rawUrl(relPath: string): string {
    return `${RESOURCE_REPO.rawBase}/${RESOURCE_REPO.owner}/${RESOURCE_REPO.repo}/${RESOURCE_REPO.branch}/${relPath}`;
  }
  private localManifestPath(): string { return path.join(this.getWorkspaceResourcesDir(), "manifest.json"); }

  private loadLocalManifest(): LocalManifest | null {
    try {
      const p = this.localManifestPath();
      if (!fs.existsSync(p)) return null;
      return parseManifest(fs.readFileSync(p, "utf-8"));
    } catch (err) { Logger.warn("读取本地 manifest 失败", { error: String(err) }); return null; }
  }
  private saveLocalManifest(m: RemoteManifest): void {
    try {
      fs.mkdirSync(this.getWorkspaceResourcesDir(), { recursive: true });
      fs.writeFileSync(this.localManifestPath(), JSON.stringify(m, null, 2), "utf-8");
    } catch (err) { Logger.error("保存本地 manifest 失败", { error: String(err) }); }
  }
  private writeResourceFile(relPath: string, content: string): void {
    const abs = path.join(this.getWorkspaceResourcesDir(), relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf-8");
  }
  private removeResourceFile(relPath: string): void {
    const abs = path.join(this.getWorkspaceResourcesDir(), relPath);
    try { if (fs.existsSync(abs)) fs.unlinkSync(abs); }
    catch (err) { Logger.warn("删除资源文件失败", { path: relPath, error: String(err) }); }
  }
  private broadcastUpdate(changedTypes: ResourceType[]): void {
    if (changedTypes.length === 0) return;
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send("resource:updated", changedTypes);
  }

  public async checkAndSync(): Promise<SyncResult> {
    if (this.status.syncing) {
      return { success: false, changedTypes: [], added: [], updated: [], error: "sync in progress" };
    }
    this.status = { ...this.status, syncing: true, lastError: null };
    try {
      const manifestUrl = this.rawUrl(RESOURCE_CONFIG.manifestPath);
      const manifestRes = await resourceHttpClient.fetchText(manifestUrl);
      if (!manifestRes.ok) return this.failSync(`拉取 manifest 失败: ${manifestRes.error}`);

      const remote = parseManifest(manifestRes.text);
      if (!remote) return this.failSync("远程 manifest 解析失败");

      const local = this.loadLocalManifest();
      const diff = compareManifests(local, remote);

      const added: string[] = [];
      const updated: string[] = [];
      const changedTypesSet = new Set<ResourceType>();

      for (const entry of [...diff.toAdd, ...diff.toUpdate]) {
        const url = this.rawUrl(`${RESOURCE_CONFIG.resourcesDir}/${entry.path}`);
        const res = await resourceHttpClient.fetchText(url);
        if (!res.ok) { Logger.warn("下载失败，跳过", { path: entry.path, error: res.error }); continue; }
        const actualHash = computeFileHash(res.text);
        if (actualHash !== entry.sha256) {
          Logger.warn("hash 校验失败，跳过", { path: entry.path, expected: entry.sha256, actual: actualHash });
          continue;
        }
        this.writeResourceFile(entry.path, res.text);
        if (diff.toAdd.includes(entry)) added.push(entry.path);
        else updated.push(entry.path);
        changedTypesSet.add(entry.type);
      }
      for (const relPath of diff.toRemove) this.removeResourceFile(relPath);

      this.saveLocalManifest(remote);
      const changedTypes = [...changedTypesSet];
      this.broadcastUpdate(changedTypes);

      this.status = { syncing: false, lastSyncAt: new Date().toISOString(), lastSyncSuccess: true, lastError: null };
      Logger.info("资源同步完成", { added: added.length, updated: updated.length, removed: diff.toRemove.length });
      return { success: true, changedTypes, added, updated };
    } catch (err) {
      return this.failSync(err instanceof Error ? err.message : String(err));
    }
  }
  private failSync(error: string): SyncResult {
    this.status = { syncing: false, lastSyncAt: new Date().toISOString(), lastSyncSuccess: false, lastError: error };
    Logger.error("资源同步失败", { error });
    return { success: false, changedTypes: [], added: [], updated: [], error };
  }
}

export const resourceSyncService = ResourceSyncService.getInstance();
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm test tests/unit/main/resource-sync.service.test.ts`
Expected: PASS，6 个用例全通过

- [ ] **Step 5: 提交**

```bash
git add src/main/core/services/resource-sync.service.ts tests/unit/main/resource-sync.service.test.ts
git commit -m "feat(resource): implement ResourceSyncService with full sync flow"
```

---

## Phase 6: IPC 层

### Task 12: 新增 resource IPC 通道

**Files:**
- Create: `src/main/core/apis/resource.api.ts`
- Create: `src/main/ipcMain/resource.ipc.ts`
- Create: `src/main/preload/modules/resource.ts`
- Create: `src/main/preload/types/resource.ts`
- Test: `tests/unit/main/resource.api.test.ts`

- [ ] **Step 1: 写失败测试**

`tests/unit/main/resource.api.test.ts`：

```ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from "vitest";
vi.mock("@/main/utils/logger", () => ({ Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() } }));

const mockSync = vi.hoisted(() => ({
  getStatus: vi.fn(() => ({ syncing: false, lastSyncAt: null, lastSyncSuccess: false, lastError: null })),
  checkAndSync: vi.fn(async () => ({ success: true, changedTypes: [], added: [], updated: [] })),
}));
vi.mock("@/main/core/services/resource-sync.service", () => ({ resourceSyncService: mockSync }));

import { getSyncStatus, syncNow } from "@/main/core/apis/resource.api";

describe("Resource API", () => {
  beforeEach(() => vi.clearAllMocks());
  it("getSyncStatus 返回状态", async () => {
    mockSync.getStatus.mockReturnValueOnce({ syncing: false, lastSyncAt: "2026-08-31T10:00:00Z", lastSyncSuccess: true, lastError: null });
    const r = await getSyncStatus();
    expect(r.success).toBe(true);
    expect(r.data?.lastSyncSuccess).toBe(true);
  });
  it("syncNow 返回同步结果", async () => {
    mockSync.checkAndSync.mockResolvedValueOnce({ success: true, changedTypes: ["slash"], added: ["slash/a.json"], updated: [] });
    const r = await syncNow();
    expect(r.success).toBe(true);
    expect(r.data?.changedTypes).toContain("slash");
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test tests/unit/main/resource.api.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 API 层**

`src/main/core/apis/resource.api.ts`：

```ts
import { resourceSyncService } from "@/main/core/services/resource-sync.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type { ApiResponse } from "@/shared/types";
import type { SyncStatus, SyncResult } from "@/shared/types/resource.types";
import { Logger } from "@/main/utils/logger";

async function getSyncStatus(): Promise<ApiResponse<SyncStatus>> {
  try { return response.success(resourceSyncService.getStatus()); }
  catch (error) { Logger.error("获取资源同步状态失败", { error: String(error) }); return response.error(ErrorCode.RESOURCE_SYNC_FAILED, error as Error); }
}
async function syncNow(): Promise<ApiResponse<SyncResult>> {
  try { return response.success(await resourceSyncService.checkAndSync()); }
  catch (error) { Logger.error("手动触发资源同步失败", { error: String(error) }); return response.error(ErrorCode.RESOURCE_SYNC_FAILED, error as Error); }
}
export { getSyncStatus, syncNow };
```

- [ ] **Step 4: 实现 IPC handler**

`src/main/ipcMain/resource.ipc.ts`：

```ts
import { ipcMain } from "electron";
import { getSyncStatus, syncNow } from "@/main/core/apis/resource.api";
import type { ApiResponse } from "@/shared/types";
import type { SyncStatus, SyncResult } from "@/shared/types/resource.types";

export function registerResourceHandlers() {
  ipcMain.handle("resource:syncStatus", async (): Promise<ApiResponse<SyncStatus>> => getSyncStatus());
  ipcMain.handle("resource:syncNow", async (): Promise<ApiResponse<SyncResult>> => syncNow());
}
```

- [ ] **Step 5: 实现 preload 类型与模块**

`src/main/preload/types/resource.ts`：

```ts
import type { ApiResponse } from "@/shared/types";
import type { SyncStatus, SyncResult } from "@/shared/types/resource.types";
import type { ResourceType } from "@/shared/enums/resource.enums";

export interface ResourceAPI {
  syncStatus: () => Promise<ApiResponse<SyncStatus>>;
  syncNow: () => Promise<ApiResponse<SyncResult>>;
  onUpdated: (callback: (changedTypes: ResourceType[]) => void) => () => void;
}
```

`src/main/preload/modules/resource.ts`：

```ts
import { ipcRenderer } from "electron";
import type { ResourceAPI } from "../types/resource";
import type { ResourceType } from "@/shared/enums/resource.enums";

export const resourceModule: ResourceAPI = {
  syncStatus: () => ipcRenderer.invoke("resource:syncStatus"),
  syncNow: () => ipcRenderer.invoke("resource:syncNow"),
  onUpdated: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, changedTypes: ResourceType[]) => callback(changedTypes);
    ipcRenderer.on("resource:updated", listener);
    return () => { ipcRenderer.removeListener("resource:updated", listener); };
  },
};
```

- [ ] **Step 6: 运行测试确认通过**

Run: `pnpm test tests/unit/main/resource.api.test.ts`
Expected: PASS

- [ ] **Step 7: typecheck**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 8: 提交**

```bash
git add src/main/core/apis/resource.api.ts src/main/ipcMain/resource.ipc.ts src/main/preload/types/resource.ts src/main/preload/modules/resource.ts tests/unit/main/resource.api.test.ts
git commit -m "feat(resource): add resource IPC channels (syncStatus/syncNow/updated)"
```

---

### Task 13: 注册 resource 模块到 preload 与 IPC

**Files:**
- Modify: `src/main/preload/modules/index.ts`
- Modify: `src/main/ipcMain/index.ts`
- Modify: `src/renderer/types/electron.d.ts`

- [ ] **Step 1: 在 preload/modules/index.ts 注册**

修改 `src/main/preload/modules/index.ts`，在 `import { attachmentModule } from "./attachment";` 之后追加：

```ts
import { resourceModule } from "./resource";
```

在 `modules` 对象末尾 `attachment: attachmentModule,` 之后追加：

```ts
  resource: resourceModule,
```

- [ ] **Step 2: 在 ipcMain/index.ts 导出**

修改 `src/main/ipcMain/index.ts`，末尾追加：

```ts
export { registerResourceHandlers } from './resource.ipc'
```

- [ ] **Step 3: 在 electron.d.ts 新增 resource 声明**

修改 `src/renderer/types/electron.d.ts`，顶部 import 区域追加（若不存在）：

```ts
import type { ResourceAPI } from "@/main/preload/types/resource";
```

在 `ElectronAPI` 接口中 `template: TemplateAPI;` 之后追加：

```ts
  // 资源同步
  resource: ResourceAPI;
```

- [ ] **Step 4: typecheck**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 5: 提交**

```bash
git add src/main/preload/modules/index.ts src/main/ipcMain/index.ts src/renderer/types/electron.d.ts
git commit -m "feat(resource): register resource module in preload and IPC index"
```

---

## Phase 7: 模板系统改造

### Task 14: 新增 TemplateResourceFile 类型

**Files:**
- Modify: `src/shared/types/template.types.ts`

- [ ] **Step 1: 在 template.types.ts 末尾追加**

```ts

/**
 * 单个 slash/page 模板资源文件（resources/{slash|page}/{id}.json）。
 * 内置模板从工作区 resources/ 加载，与远程同步统一存储。
 * profession 为数组（支持多职业），含 version/tags/enabled 字段。
 */
export interface TemplateResourceFile {
  id: string;
  version: string;
  title: LocalizedText;
  description: LocalizedText;
  icon: TemplateIconName;
  markdown: LocalizedText;
  profession: Profession[];
  tags: string[];
  enabled: boolean;
}
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 3: 提交**

```bash
git add src/shared/types/template.types.ts
git commit -m "feat(template): add TemplateResourceFile type for JSON resource files"
```

---

### Task 15: template.service 新增 getBuiltInTemplates + IPC

**Files:**
- Modify: `src/main/core/services/template.service.ts`
- Modify: `src/main/core/apis/template.api.ts`
- Modify: `src/main/ipcMain/template.ipc.ts`
- Modify: `src/main/preload/modules/template.ts`
- Modify: `src/main/preload/types/template.ts`
- Modify: `tests/unit/main/template.api.test.ts`

- [ ] **Step 1: 在 template.service 新增方法**

修改 `src/main/core/services/template.service.ts`：

顶部 import 追加（检查避免重复）：

```ts
import { RESOURCES_DIR } from "@/main/constants/folder.constants";
import type { TemplateResourceFile } from "@/shared/types/template.types";
import type { Profession } from "@/shared/enums/profession.enums";
```

在 `TemplateService` 类中 `getTemplatesFile` 方法之后追加：

```ts
  /**
   * 加载内置模板（从工作区 resources/{type}/ 目录扫描）。
   * 文件缺失或损坏时返回空数组。
   */
  public getBuiltInTemplates(type: TemplateType): TemplateResourceFile[] {
    this.assertValidType(type);
    const dir = type === TEMPLATE_TYPE.SLASH ? SLASH_TEMPLATES_DIR : PAGE_TEMPLATES_DIR;
    const resourcesDir = path.join(this.getWorkspacePath(), RESOURCES_DIR, dir);
    if (!fs.existsSync(resourcesDir)) return [];

    let files: string[];
    try { files = fs.readdirSync(resourcesDir).filter((f) => f.endsWith(".json")); }
    catch (err) { Logger.warn("读取内置模板目录失败", { dir: resourcesDir, error: String(err) }); return []; }

    const result: TemplateResourceFile[] = [];
    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(resourcesDir, file), "utf-8")) as Partial<TemplateResourceFile>;
        if (!data.id || typeof data.id !== "string") continue;
        result.push({
          id: data.id,
          version: typeof data.version === "string" ? data.version : "0.0.0",
          title: data.title ?? { zh: data.id, en: data.id },
          description: data.description ?? { zh: "", en: "" },
          icon: isTemplateIconName(data.icon) ? data.icon : DEFAULT_TEMPLATE_ICON,
          markdown: data.markdown ?? { zh: "", en: "" },
          profession: Array.isArray(data.profession)
            ? data.profession.filter((p): p is Profession => typeof p === "string" && p !== PROFESSION.CUSTOM)
            : [PROFESSION.GENERAL],
          tags: Array.isArray(data.tags) ? data.tags : [],
          enabled: data.enabled !== false,
        });
      } catch (err) { Logger.warn("解析内置模板文件失败", { file, error: String(err) }); }
    }
    return result;
  }
```

- [ ] **Step 2: 在 template.api 新增 getBuiltIn**

修改 `src/main/core/apis/template.api.ts`：

顶部 import 追加：

```ts
import type { TemplateResourceFile } from "@/shared/types/template.types";
```

末尾 `setTemplateEnabled` 函数之后追加：

```ts
async function getBuiltIn(type: TemplateType): Promise<ApiResponse<TemplateResourceFile[]>> {
  try { return response.success(templateService.getBuiltInTemplates(type)); }
  catch (error) { Logger.error("获取内置模板失败", { error: String(error), type }); return response.error(ErrorCode.TEMPLATE_GET_FAILED, error as Error); }
}
```

末尾 export 修改为：

```ts
export { getFile, upsertCustom, deleteCustom, setEnabled, getBuiltIn };
```

- [ ] **Step 3: 在 template.ipc 注册通道**

修改 `src/main/ipcMain/template.ipc.ts`：

顶部 import 追加 `getBuiltIn`：

```ts
import { getFile, upsertCustom, deleteCustom, setEnabled, getBuiltIn } from "@/main/core/apis/template.api";
```

import type 追加：

```ts
import type { TemplateResourceFile } from "@/shared/types/template.types";
```

末尾追加 handler：

```ts
  ipcMain.handle(
    "template:getBuiltIn",
    async (_, type: TemplateType): Promise<ApiResponse<TemplateResourceFile[]>> => getBuiltIn(type),
  );
```

- [ ] **Step 4: 在 preload/modules/template 新增 getBuiltIn**

修改 `src/main/preload/modules/template.ts`：

```ts
export const templateModule: TemplateAPI = {
  getFile: (type) => ipcRenderer.invoke("template:getFile", type),
  getBuiltIn: (type) => ipcRenderer.invoke("template:getBuiltIn", type),
  upsertCustom: (type, tpl) => ipcRenderer.invoke("template:upsertCustom", type, tpl),
  deleteCustom: (type, id) => ipcRenderer.invoke("template:deleteCustom", type, id),
  setEnabled: (type, id, builtIn, enabled) => ipcRenderer.invoke("template:setEnabled", type, id, builtIn, enabled),
};
```

- [ ] **Step 5: 在 preload/types/template 新增类型**

修改 `src/main/preload/types/template.ts`：

```ts
import type { ApiResponse } from "@/shared/types";
import type { TemplateType } from "@/shared/enums/template.enums";
import type { CustomTemplate, TemplateFile, TemplateResourceFile } from "@/shared/types/template.types";

export interface TemplateAPI {
  getFile: (type: TemplateType) => Promise<ApiResponse<TemplateFile>>;
  getBuiltIn: (type: TemplateType) => Promise<ApiResponse<TemplateResourceFile[]>>;
  upsertCustom: (type: TemplateType, tpl: CustomTemplate) => Promise<ApiResponse<TemplateFile>>;
  deleteCustom: (type: TemplateType, id: string) => Promise<ApiResponse<TemplateFile>>;
  setEnabled: (type: TemplateType, id: string, builtIn: boolean, enabled: boolean) => Promise<ApiResponse<TemplateFile>>;
}
```

- [ ] **Step 6: 在 electron.d.ts 补全 TemplateAPI import**

修改 `src/renderer/types/electron.d.ts`，顶部 import 区域追加（若不存在）：

```ts
import type { TemplateAPI } from "@/main/preload/types/template";
```

- [ ] **Step 7: 更新 template.api.test.ts**

修改 `tests/unit/main/template.api.test.ts`：

在 `mockTemplateService` 对象中追加 mock：

```ts
    getBuiltInTemplates: vi.fn(() => [
      {
        id: "todo", version: "1.0.0",
        title: { zh: "待办清单", en: "Todo List" },
        description: { zh: "插入待办清单", en: "Insert a todo list" },
        icon: "check_circle",
        markdown: { zh: "## 待办", en: "## Todo" },
        profession: ["general"], tags: ["list"], enabled: true,
      },
    ]),
```

import 追加 `getBuiltIn`：

```ts
import { getFile, upsertCustom, deleteCustom, setEnabled, getBuiltIn } from "@/main/core/apis/template.api"
```

describe 末尾追加用例：

```ts
  it("getBuiltIn 返回内置模板数组", async () => {
    const res = await getBuiltIn(TEMPLATE_TYPE.SLASH)
    expect(res.success).toBe(true)
    expect(mockTemplateService.getBuiltInTemplates).toHaveBeenCalledWith(TEMPLATE_TYPE.SLASH)
    expect(res.data).toHaveLength(1)
    expect(res.data?.[0].id).toBe("todo")
  })
```

- [ ] **Step 8: 运行测试**

Run: `pnpm test tests/unit/main/template.api.test.ts`
Expected: PASS

- [ ] **Step 9: typecheck**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 10: 提交**

```bash
git add src/main/core/services/template.service.ts src/main/core/apis/template.api.ts src/main/ipcMain/template.ipc.ts src/main/preload/modules/template.ts src/main/preload/types/template.ts src/renderer/types/electron.d.ts tests/unit/main/template.api.test.ts
git commit -m "feat(template): add getBuiltInTemplates service + IPC for loading JSON resources"
```

---

### Task 16: 更新 template.store 与 template-merge

**Files:**
- Modify: `src/renderer/store/template.store.ts`
- Modify: `src/renderer/components/editor/slash/commands/template-merge.ts`
- Modify: `tests/unit/renderer/template-merge.test.ts`

- [ ] **Step 1: 更新 template-merge.ts**

修改 `src/renderer/components/editor/slash/commands/template-merge.ts`：

```ts
import { LOCALE } from "@/shared/enums";
import type {
  TemplateResourceFile,
  TemplateFile,
  TemplateItem,
} from "@/shared/types/template.types";
import type { Profession } from "@/shared/enums/profession.enums";

/**
 * 把内置模板（按当前语言解析）+ 自定义模板合并为统一列表。
 * 自定义模板排前，内置模板在后。slash 与 page 模板共用。
 * 内置模板 profession 为数组，取第一个非 CUSTOM 职业作为 TemplateItem.profession。
 */
export function mergeTemplates(
  builtins: TemplateResourceFile[],
  file: TemplateFile | null,
  locale: string,
): TemplateItem[] {
  const disabled = new Set(file?.disabledTemplateIds ?? []);
  const useEn = locale === LOCALE.EN;

  const builtinItems: TemplateItem[] = builtins.map((def) => ({
    id: def.id,
    title: useEn ? def.title.en : def.title.zh,
    description: useEn ? def.description.en : def.description.zh,
    icon: def.icon,
    markdown: useEn ? def.markdown.en : def.markdown.zh,
    profession: (def.profession[0] ?? "general") as Profession,
    builtIn: true,
    enabled: !disabled.has(def.id),
  }));

  const customItems: TemplateItem[] = (file?.customTemplates ?? []).map((c) => ({
    id: c.id, title: c.title, description: c.description, icon: c.icon,
    markdown: c.markdown, profession: c.profession, builtIn: false, enabled: c.enabled,
  }));

  return [...customItems, ...builtinItems];
}
```

- [ ] **Step 2: 更新 template-merge 测试**

修改 `tests/unit/renderer/template-merge.test.ts`，把 `builtinTemplates` 改为构造 `TemplateResourceFile[]` 字面量：

```ts
import { describe, it, expect } from "vitest";
import { LOCALE } from "@/shared/enums/config.enums";
import { mergeTemplates } from "@/renderer/components/editor/slash/commands/template-merge";
import type { TemplateFile, TemplateResourceFile } from "@/shared/types/template.types";

const BUILTINS: TemplateResourceFile[] = [
  {
    id: "todo", version: "1.0.0",
    title: { zh: "待办清单", en: "Todo List" },
    description: { zh: "插入待办清单", en: "Insert a todo list" },
    icon: "check_circle",
    markdown: { zh: "## 待办清单", en: "## Todo List" },
    profession: ["general"], tags: ["list"], enabled: true,
  },
];

const FILE: TemplateFile = {
  customTemplates: [
    { id: "custom_1", title: "我的模板", description: "自定义", icon: "description", markdown: "# 自定义", profession: "pm", enabled: true },
  ],
  disabledTemplateIds: ["todo"],
};

describe("mergeTemplates", () => {
  it("空文件返回全部内置且为内置标记", () => {
    const items = mergeTemplates(BUILTINS, null, LOCALE.ZH);
    expect(items.length).toBe(BUILTINS.length);
    expect(items.every((item) => item.builtIn)).toBe(true);
    expect(items.every((item) => item.enabled)).toBe(true);
  });
  it("按语言解析标题/正文", () => {
    const zh = mergeTemplates(BUILTINS, null, LOCALE.ZH).find((i) => i.id === "todo")!;
    const en = mergeTemplates(BUILTINS, null, LOCALE.EN).find((i) => i.id === "todo")!;
    expect(zh.title).toBe("待办清单");
    expect(en.title).toBe("Todo List");
  });
  it("禁用列表中的模板 enabled=false", () => {
    const todo = mergeTemplates(BUILTINS, FILE, LOCALE.ZH).find((i) => i.id === "todo")!;
    expect(todo.enabled).toBe(false);
  });
  it("自定义模板排前且 builtIn=false", () => {
    const items = mergeTemplates(BUILTINS, FILE, LOCALE.ZH);
    expect(items[0].id).toBe("custom_1");
    expect(items[0].builtIn).toBe(false);
  });
  it("自定义模板不随语言切换改变", () => {
    const zh = mergeTemplates(BUILTINS, FILE, LOCALE.ZH)[0];
    const en = mergeTemplates(BUILTINS, FILE, LOCALE.EN)[0];
    expect(zh.title).toBe(en.title);
  });
});
```

- [ ] **Step 3: 运行测试**

Run: `pnpm test tests/unit/renderer/template-merge.test.ts`
Expected: PASS

- [ ] **Step 4: 更新 template.store**

修改 `src/renderer/store/template.store.ts`：

```ts
import { ref } from "vue";
import { defineStore } from "pinia";
import type {
  CustomTemplate, TemplateFile, TemplateItem, TemplateResourceFile,
} from "@/shared/types/template.types";
import { TEMPLATE_TYPE, type TemplateType } from "@/shared/enums/template.enums";
import { mergeTemplates } from "@/renderer/components/editor/slash/commands/template-merge";

export const useTemplateStore = defineStore("template", () => {
  const files = ref<Record<TemplateType, TemplateFile | null>>({
    [TEMPLATE_TYPE.SLASH]: null,
    [TEMPLATE_TYPE.PAGE]: null,
  });
  const builtins = ref<Record<TemplateType, TemplateResourceFile[] | null>>({
    [TEMPLATE_TYPE.SLASH]: null,
    [TEMPLATE_TYPE.PAGE]: null,
  });
  const loading = ref<Record<TemplateType, boolean>>({
    [TEMPLATE_TYPE.SLASH]: false,
    [TEMPLATE_TYPE.PAGE]: false,
  });

  function isLoaded(type: TemplateType): boolean {
    return files.value[type] !== null && builtins.value[type] !== null;
  }

  async function fetch(type: TemplateType): Promise<void> {
    if (loading.value[type] || isLoaded(type)) return;
    loading.value[type] = true;
    try {
      const [fileRes, builtinRes] = await Promise.all([
        window.electronAPI.template.getFile(type),
        window.electronAPI.template.getBuiltIn(type),
      ]);
      if (fileRes.success && fileRes.data) files.value[type] = fileRes.data;
      if (builtinRes.success && builtinRes.data) builtins.value[type] = builtinRes.data;
    } finally {
      loading.value[type] = false;
    }
  }

  async function saveCustom(type: TemplateType, tpl: CustomTemplate): Promise<boolean> {
    const res = await window.electronAPI.template.upsertCustom(type, tpl);
    if (res.success && res.data) { files.value[type] = res.data; return true; }
    return false;
  }

  async function removeCustom(type: TemplateType, id: string): Promise<boolean> {
    const res = await window.electronAPI.template.deleteCustom(type, id);
    if (res.success && res.data) { files.value[type] = res.data; return true; }
    return false;
  }

  async function setEnabled(type: TemplateType, id: string, builtIn: boolean, enabled: boolean): Promise<boolean> {
    const res = await window.electronAPI.template.setEnabled(type, id, builtIn, enabled);
    if (res.success && res.data) { files.value[type] = res.data; return true; }
    return false;
  }

  /** 监听 resource:updated 后清空缓存重新加载 */
  function invalidate(types: TemplateType[]): void {
    for (const type of types) {
      files.value[type] = null;
      builtins.value[type] = null;
    }
  }

  function allTemplates(type: TemplateType, locale: string): TemplateItem[] {
    return mergeTemplates(builtins.value[type] ?? [], files.value[type], locale);
  }

  return { files, builtins, isLoaded, fetch, saveCustom, removeCustom, setEnabled, invalidate, allTemplates };
});
```

- [ ] **Step 5: typecheck**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 6: 提交**

```bash
git add src/renderer/store/template.store.ts src/renderer/components/editor/slash/commands/template-merge.ts tests/unit/renderer/template-merge.test.ts
git commit -m "refactor(template): store loads builtins via IPC, mergeTemplates accepts TemplateResourceFile"
```

---

### Task 17: 删除 TS 硬编码内置模板

**Files:**
- Delete: `src/renderer/templates/builtin-page-templates.ts`
- Delete: `tests/unit/renderer/builtin-page-templates.test.ts`
- Modify: `src/renderer/components/editor/slash/commands/templates.ts`
- Modify: `tests/unit/renderer/slash-templates.test.ts`

- [ ] **Step 1: 删除 builtin-page-templates.ts 及其测试**

删除文件 `src/renderer/templates/builtin-page-templates.ts`。
删除文件 `tests/unit/renderer/builtin-page-templates.test.ts`。

- [ ] **Step 2: 精简 templates.ts**

替换 `src/renderer/components/editor/slash/commands/templates.ts` 全文为：

```ts
import type { CommandGroup, SlashCommand } from "./types";
import type { TemplateItem } from "@/shared/types/template.types";
import { insertMarkdownTemplate } from "./helpers";
import { resolveTemplateIcon } from "./template-icons";

/** 由模板条目数组构建 Slash 命令组；空数组返回 null */
export function buildTemplateGroup(
  t: (key: string) => string,
  items: TemplateItem[],
): CommandGroup | null {
  if (items.length === 0) return null;
  const commands: SlashCommand[] = items.map((tpl) => ({
    id: tpl.id,
    title: tpl.title,
    description: tpl.description,
    icon: resolveTemplateIcon(tpl.icon),
    action: ({ editor, pos }) => {
      insertMarkdownTemplate(editor, pos, tpl.markdown);
    },
  }));
  return {
    id: "template",
    label: t("EDITOR.SLASH.TEMPLATE.GROUP_LABEL"),
    items: commands,
  };
}
```

- [ ] **Step 3: 更新 slash-templates.test.ts**

替换 `tests/unit/renderer/slash-templates.test.ts` 全文为：

```ts
import { describe, it, expect } from "vitest";
import { LOCALE } from "@/shared/enums/config.enums";
import { buildTemplateGroup } from "@/renderer/components/editor/slash/commands/templates";
import { mergeTemplates } from "@/renderer/components/editor/slash/commands/template-merge";
import { getCommandGroups } from "@/renderer/components/editor/slash/commands/registry";
import type { TemplateItem, TemplateResourceFile } from "@/shared/types/template.types";

const t = (key: string) => key;

const BUILTINS: TemplateResourceFile[] = [
  {
    id: "todo", version: "1.0.0",
    title: { zh: "待办清单", en: "Todo List" },
    description: { zh: "插入待办清单", en: "Insert a todo list" },
    icon: "check_circle",
    markdown: { zh: "## 待办", en: "## Todo" },
    profession: ["general"], tags: ["list"], enabled: true,
  },
];

describe("buildTemplateGroup", () => {
  it("空数组返回 null", () => {
    expect(buildTemplateGroup(t, [])).toBeNull();
  });
  it("非空返回命令组", () => {
    const items: TemplateItem[] = mergeTemplates(BUILTINS, null, LOCALE.ZH);
    const group = buildTemplateGroup(t, items);
    expect(group).not.toBeNull();
    expect(group!.id).toBe("template");
    expect(group!.items.length).toBeGreaterThan(0);
    for (const item of group!.items) expect(typeof item.action).toBe("function");
  });
});

describe("getCommandGroups", () => {
  it("包含模板组", () => {
    const items = mergeTemplates(BUILTINS, null, LOCALE.ZH);
    const groups = getCommandGroups(t, items);
    expect(groups.map((g) => g.id)).toContain("template");
  });
});
```

- [ ] **Step 4: 运行测试**

Run: `pnpm test tests/unit/renderer/slash-templates.test.ts tests/unit/renderer/template-merge.test.ts`
Expected: PASS

- [ ] **Step 5: typecheck**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 6: 提交**

```bash
git add src/renderer/components/editor/slash/commands/templates.ts src/renderer/templates/builtin-page-templates.ts tests/unit/renderer/builtin-page-templates.test.ts tests/unit/renderer/slash-templates.test.ts
git commit -m "refactor(template): remove hardcoded builtin templates, load from JSON resources"
```

---

## Phase 8: Skill 系统改造

### Task 18: 更新 skill.manager loadSkills

**Files:**
- Modify: `src/main/core/skills/skill.manager.ts`
- Modify: `src/shared/types/skill.types.ts`

- [ ] **Step 1: 修改 SkillSource 类型**

修改 `src/shared/types/skill.types.ts`：

```ts
export type SkillSource = "built-in" | "custom";
```

- [ ] **Step 2: 修改 skill.manager.ts**

修改 `src/main/core/skills/skill.manager.ts`：

顶部 import 追加：

```ts
import { RESOURCES_DIR } from "@/main/constants/folder.constants";
```

替换 `initialize` 方法为：

```ts
  public initialize(): void {
    try {
      const workspacePath: string = (globalThis as Record<string, unknown>)
        .__WRISP_WORKSPACE_PATH__ as string;

      if (workspacePath && workspacePath.trim() !== "") {
        this.skillsDir = path.join(workspacePath, "skills");
      } else {
        this.skillsDir = path.join(app.getPath("userData"), "skills");
      }

      if (!fs.existsSync(this.skillsDir)) {
        Logger.info("Skills directory not found, creating...");
        fs.mkdirSync(path.join(this.skillsDir, CUSTOM), { recursive: true });
      }

      // 兼容旧版本：废弃目录日志提示
      const legacyBuiltIn = path.join(this.skillsDir, BUILT_IN);
      if (fs.existsSync(legacyBuiltIn)) {
        Logger.warn("检测到废弃的 <skillsDir>/built-in/ 目录，已停止加载。新版本从 <workspace>/resources/skills/ 加载。", { legacyDir: legacyBuiltIn });
      }
      const legacyRemote = path.join(this.skillsDir, REMOTE);
      if (fs.existsSync(legacyRemote)) {
        Logger.warn("检测到废弃的 <skillsDir>/remote/ 目录，已停止加载。远程同步由 resource-sync 处理。", { legacyDir: legacyRemote });
      }

      this.loadSkills();
      Logger.info("SkillManager initialized", { skillsDir: this.skillsDir, skillCount: this.skills.size });
    } catch (error) {
      Logger.error("SkillManager initialization failed", { error: String(error) });
    }
  }
```

替换 `loadSkills` 方法为：

```ts
  private loadSkills(): void {
    const workspacePath: string = (globalThis as Record<string, unknown>)
      .__WRISP_WORKSPACE_PATH__ as string;
    const builtinDir = workspacePath
      ? path.join(workspacePath, RESOURCES_DIR, "skills")
      : path.join(app.getPath("userData"), RESOURCES_DIR, "skills");
    const customDir = path.join(this.skillsDir, CUSTOM);

    const sourceDirs: { dir: string; source: SkillSource }[] = [
      { dir: builtinDir, source: BUILT_IN as SkillSource },
      { dir: customDir, source: CUSTOM as SkillSource },
    ];

    for (const { dir, source } of sourceDirs) {
      if (!fs.existsSync(dir)) continue;
      let files: string[];
      try { files = fs.readdirSync(dir).filter((f) => f.endsWith(".skill.json")); }
      catch { Logger.warn(`Failed to read directory: ${dir}`); continue; }

      for (const file of files) {
        const filePath = path.join(dir, file);
        try {
          const skill: SkillDefinition = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          const validation = skillSchemaValidator.validate(skill);
          if (!validation.valid) {
            Logger.warn(`Skill validation failed: ${filePath}`, { errors: validation.errors.map((e) => `${e.field}: ${e.message}`).join("; ") });
            continue;
          }
          this.skills.set(skill.id, skill);
          this.skillSources.set(skill.id, source);
        } catch (error) { Logger.warn(`Failed to load skill file: ${filePath}`, { error: String(error) }); }
      }
    }

    this.loadManifest();
    this.loadSettings();
    this.applySettings();
  }
```

删除 `copyBuiltInSkills`、`syncBuiltInSkills`、`getBuiltInSourceDir` 三个方法。

> 顶部常量 `const REMOTE = "remote";` 保留用于兼容日志。

- [ ] **Step 3: typecheck**

Run: `pnpm typecheck`
Expected: 可能报错 skill.updater.ts 引用 `"remote"` 类型，下个任务删除该文件后修复

- [ ] **Step 4: 提交**

```bash
git add src/main/core/skills/skill.manager.ts src/shared/types/skill.types.ts
git commit -m "refactor(skill): load builtins from <workspace>/resources/skills/, remove remote source"
```

---

### Task 19: 删除 skill.updater.ts 及引用

**Files:**
- Delete: `src/main/core/skills/skill.updater.ts`
- Modify: 引用 `skillUpdater` 的所有文件（需先搜索）

- [ ] **Step 1: 搜索 skillUpdater 引用**

用 Grep 搜索 `skillUpdater`，列出所有引用文件。

- [ ] **Step 2: 移除引用**

对每个引用文件：
- 删除 `import { skillUpdater }` 语句
- 删除调用 `skillUpdater.checkForUpdates()` / `applyUpdates()` 代码
- 删除对应 IPC 通道（`skill:checkUpdates`、`skill:applyUpdates`）注册
- 删除 preload 中 `checkSkillUpdates` / `applySkillUpdates` 方法
- 删除 electron.d.ts 中对应声明

> 常见位置：`src/main/ipcMain/skill.ipc.ts`、`src/main/preload/modules/skill.ts`、`src/main/preload/types/skill.ts`、`src/renderer/types/electron.d.ts`。具体以搜索结果为准。

- [ ] **Step 3: 删除 skill.updater.ts**

删除文件 `src/main/core/skills/skill.updater.ts`。

- [ ] **Step 4: 在 config.constants.ts 保留 skillsConfig 字段但禁用**

修改 `src/main/constants/config.constants.ts`，`skillsConfig` 改为：

```ts
  skillsConfig: {
    remoteUpdateEnabled: false,
    remoteUpdateUrl: "",
  },
```

> 保留字段避免破坏 AppConfig 类型；后续独立任务清理。

- [ ] **Step 5: typecheck**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 6: 运行全部测试**

Run: `pnpm test`
Expected: 全部通过

- [ ] **Step 7: 提交**

```bash
git add src/main/core/skills/skill.updater.ts src/main/ipcMain/skill.ipc.ts src/main/preload/modules/skill.ts src/main/preload/types/skill.ts src/renderer/types/electron.d.ts src/main/constants/config.constants.ts
git commit -m "refactor(skill): remove skill.updater.ts, unified by resource-sync"
```

---

## Phase 9: 构建配置 + 工作区初始化

### Task 20: vite.config.mts 新增 copyResources

**Files:**
- Modify: `vite.config.mts`

- [ ] **Step 1: 新增 copyResources 函数**

修改 `vite.config.mts`，在 `copySchemas()` 函数定义之后新增：

```ts
function copyResources() {
  const srcPath = path.resolve(import.meta.dirname, 'resources')
  const destPath = path.resolve(import.meta.dirname, 'dist-electron/resources')

  if (fs.existsSync(srcPath)) {
    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(destPath, { recursive: true })
    }

    const files = fs.readdirSync(srcPath)
    files.forEach(file => {
      copyRecursive(path.join(srcPath, file), path.join(destPath, file))
    })
  }
}
```

- [ ] **Step 2: 调用 copyResources**

找到 `copySchemas()` 调用行，在其后追加：

```ts
copyResources()
```

- [ ] **Step 3: 验证 build**

Run: `pnpm build`
Expected: 构建成功，`dist-electron/resources/` 存在

- [ ] **Step 4: 验证复制结果**

Run: `node -e "const fs=require('fs');console.log('exists:',fs.existsSync('dist-electron/resources'));console.log('slash:',fs.readdirSync('dist-electron/resources/slash').length);console.log('page:',fs.readdirSync('dist-electron/resources/page').length);console.log('skills:',fs.readdirSync('dist-electron/resources/skills').length)"`
Expected: exists: true，slash: 18，page: 5，skills: 12

- [ ] **Step 5: 提交**

```bash
git add vite.config.mts
git commit -m "build(resource): copy resources/ to dist-electron/resources/ at build time"
```

---

### Task 21: workspace-init 首次复制 resources

**Files:**
- Modify: `src/main/core/services/base/workspace-init.service.ts`

- [ ] **Step 1: 修改 workspace-init**

修改 `src/main/core/services/base/workspace-init.service.ts`：

顶部 import 追加（检查避免重复）：

```ts
import { app } from "electron";
import { RESOURCES_DIR } from "@/main/constants";
```

在 `ensureWorkspace` 方法中，`Logger.info("工作空间已就绪", { workspacePath });` 之前追加：

```ts
      // 首次启动：从打包 resources 复制到工作区
      await this.ensureResourcesCopied(workspacePath);
```

在类中新增方法：

```ts
  /**
   * 首次启动（<workspace>/resources/ 不存在）时从打包的 resources 整体复制。
   * 后续启动不覆盖（由 resource-sync 负责增量更新）。
   */
  private async ensureResourcesCopied(workspacePath: string): Promise<void> {
    const targetDir = path.join(workspacePath, RESOURCES_DIR);
    if (fs.existsSync(targetDir)) return;

    const isDev = !!process.env.VITE_DEV_SERVER_URL;
    const sourceDir = isDev
      ? path.resolve(app.getAppPath(), "resources")
      : path.join(__dirname, "..", "resources");

    if (!fs.existsSync(sourceDir)) {
      Logger.warn("打包 resources 目录不存在，跳过首次复制", { sourceDir });
      return;
    }
    try {
      fs.mkdirSync(targetDir, { recursive: true });
      this.copyDirectory(sourceDir, targetDir);
      Logger.info("首次启动已复制 resources 到工作区", { sourceDir, targetDir });
    } catch (error) {
      Logger.error("复制 resources 失败", { error: String(error), sourceDir, targetDir });
    }
  }

  private copyDirectory(src: string, dest: string): void {
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 3: 提交**

```bash
git add src/main/core/services/base/workspace-init.service.ts
git commit -m "feat(resource): copy resources/ to workspace on first launch"
```

---

## Phase 10: 启动流程集成

### Task 22: main/index.ts 注册 handler 与启动同步

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: 新增 import**

修改 `src/main/index.ts`，在 `import { registerAttachmentHandlers } from "@/main/ipcMain";` 之后追加：

```ts
import { registerResourceHandlers } from "@/main/ipcMain";
```

在 `import { workspaceInitService }` 之后追加：

```ts
import { resourceSyncService } from "@/main/core/services/resource-sync.service";
```

- [ ] **Step 2: 注册 handler**

在 `registerAttachmentHandlers();` 之后追加：

```ts
  registerResourceHandlers();
```

- [ ] **Step 3: 异步触发同步**

在 `// 初始化定时任务调度器` 之前（或 `scheduler.startAll()` 之前）追加：

```ts
  // 异步触发资源同步（不阻塞启动；失败静默，使用本地缓存）
  resourceSyncService.checkAndSync().catch((err) => {
    Logger.error("资源同步启动失败", { error: String(err) });
  });
```

- [ ] **Step 4: typecheck**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 5: 启动应用验证**

Run: `pnpm dev`
Expected: 应用正常启动，日志可见同步结果或失败（不影响启动）

- [ ] **Step 6: 提交**

```bash
git add src/main/index.ts
git commit -m "feat(resource): register handlers and trigger async sync on startup"
```

---

## Phase 11: UI 增强

### Task 23: TemplateSettings 新增版本/同步按钮

**Files:**
- Modify: `src/renderer/components/settings/TemplateSettings.vue`

**说明：** 本任务为增强。新增：版本列、"立即检查模板更新"按钮、监听 `resource:updated` 刷新 store。

- [ ] **Step 1: 修改 TemplateSettings.vue**

修改 `src/renderer/components/settings/TemplateSettings.vue`。

在 `<script setup>` 中，在 `import { useTemplateStore }` 之后追加：

```ts
import { onMounted, onUnmounted } from "vue";
```

在 `const store = useTemplateStore();` 之后追加同步逻辑：

```ts
// 监听 resource:updated 事件，刷新 store
const syncing = ref(false);
let offUpdated: (() => void) | null = null;

async function onSyncNow() {
  if (syncing.value) return;
  syncing.value = true;
  try {
    const res = await window.electronAPI.resource.syncNow();
    if (res.success && res.data?.success) {
      // 同步成功，store 已通过 resource:updated 事件刷新
      message.success("模板同步完成");
    } else {
      message.error("模板同步失败");
    }
  } finally {
    syncing.value = false;
  }
}

onMounted(() => {
  offUpdated = window.electronAPI.resource.onUpdated((changedTypes) => {
    // 把 ResourceType 映射到 TemplateType 并失效缓存
    const types: TemplateType[] = [];
    if (changedTypes.includes("slash" as never)) types.push(TEMPLATE_TYPE.SLASH);
    if (changedTypes.includes("page" as never)) types.push(TEMPLATE_TYPE.PAGE);
    if (types.length > 0) {
      store.invalidate(types);
      for (const t of types) store.fetch(t);
    }
  });
});

onUnmounted(() => {
  offUpdated?.();
});
```

> 注：`changedTypes` 是 `ResourceType[]`，包含 `"slash"` / `"page"` / `"skill"`。template store 只关心 slash/page。直接用 `as never` 简化跨枚举类型比较，避免引入额外转换函数。

在 `<template>` 中，"新建" 按钮之后追加"立即检查模板更新"按钮：

```vue
      <n-button :loading="syncing" @click="onSyncNow">
        {{ t("SETTINGS.TEMPLATE_SETTINGS.SYNC_NOW") }}
      </n-button>
```

在 `columns` 数组中，"类型" 列之后新增"版本"列：

```ts
  {
    title: t("SETTINGS.TEMPLATE_SETTINGS.VERSION"),
    key: "version",
    width: 80,
    render: (row) => (row.builtIn ? "—" : "—"),
  },
```

> 注：当前 `TemplateItem` 无 version 字段，简化显示 "—"。如需显示版本号，需在 TemplateItem 类型与 mergeTemplates 中补 version 字段（可作后续增强，本任务先占位列）。

- [ ] **Step 2: 新增 i18n 键**

修改 `src/shared/i18n/locales/zhCN.ts`，在 `SETTINGS.TEMPLATE_SETTINGS` 段新增：

```ts
    VERSION: "版本",
    SYNC_NOW: "检查模板更新",
```

修改 `src/shared/i18n/locales/enUS.ts` 对应段新增：

```ts
    VERSION: "Version",
    SYNC_NOW: "Check Template Updates",
```

> 具体行号需打开文件定位 `TEMPLATE_SETTINGS` 段落。

- [ ] **Step 3: typecheck**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 4: lint**

Run: `pnpm lint`
Expected: 通过

- [ ] **Step 5: 提交**

```bash
git add src/renderer/components/settings/TemplateSettings.vue src/shared/i18n/locales/zhCN.ts src/shared/i18n/locales/enUS.ts
git commit -m "feat(ui): TemplateSettings adds version column and sync-now button"
```

---

## Phase 12: 收尾

### Task 24: 全量回归测试

**Files:**
- 无文件改动

- [ ] **Step 1: 运行全部单元测试**

Run: `pnpm test`
Expected: 全部通过

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: 通过

- [ ] **Step 3: lint**

Run: `pnpm lint`
Expected: 通过

- [ ] **Step 4: build**

Run: `pnpm build`
Expected: 构建成功，`dist-electron/resources/` 存在且包含 34 个 manifest 条目对应的文件

- [ ] **Step 5: 启动应用验证**

Run: `pnpm dev`

手动验证：
1. 应用正常启动
2. 首次启动 `<workspace>/resources/` 被创建并填充
3. slash 菜单显示 18 个内置模板（中英双语切换正常）
4. 新建页面弹窗显示 5 个内置模板
5. 设置页模板管理显示内置 + 自定义模板
6. skill 列表显示 11 个内置 skill
7. 日志可见"资源同步完成"

- [ ] **Step 6: 提交（如有 lint 自动修复）**

```bash
git add -A
git commit -m "test(resource): full regression after remote template sync"
```

> 若无改动可跳过此提交。

---

## 自审清单

### Spec coverage

| Spec 章节 | 对应 Task |
|---|---|
| 设计决策表 | Task 1-4（基础）、5-8（迁移）、9-11（同步）、12-13（IPC） |
| 目录结构（resources/） | Task 5-8（创建）、20（打包）、21（首次复制） |
| 目录结构（工作区 resources/） | Task 21（首次复制）、11（同步写入） |
| manifest.json 结构 | Task 8（生成）、9（解析比对） |
| TemplateResourceFile 数据结构 | Task 14（类型）、5-6（JSON 文件） |
| skill 文件去 built-in 子目录 | Task 7（移动）、18（加载逻辑） |
| 同步流程（7 步） | Task 11（实现） |
| 核心新增组件（9 文件） | Task 1-4, 9-13 |
| 常量定义（resource.constants.ts） | Task 3 |
| IPC 通道（3 个） | Task 12-13 |
| Slash 模板系统改动 | Task 14-17 |
| Page 模板系统改动 | Task 14-17 |
| Skill 模板系统改动 | Task 7, 18-19 |
| 工作区初始化 | Task 21 |
| 启动流程 | Task 22 |
| 渲染层刷新 | Task 16（store invalidate）、23（监听） |
| 打包配置 | Task 20 |
| 测试策略 | Task 1, 9, 10, 11, 12, 15, 16, 17, 24 |
| 扩展性 | ResourceType 枚举（Task 1）+ manifest 通用 entry（Task 8-9） |
| 实施步骤 7 Phase | 本计划 12 Phase 覆盖 |

### Placeholder scan

无 TBD/TODO。所有步骤含具体代码或具体命令。

### Type consistency

- `ResourceType` 在 enums（Task 1）、types（Task 2）、manifest（Task 9）、sync（Task 11）、IPC（Task 12）一致
- `TemplateResourceFile` 在 types（Task 14）、service（Task 15）、merge（Task 16）、store（Task 16）一致
- `getBuiltInTemplates(type)` 在 service（Task 15）、api（Task 15）、ipc（Task 15）、preload（Task 15）一致
- `resourceSyncService.checkAndSync()` 在 service（Task 11）、api（Task 12）、main（Task 22）一致
- `RESOURCES_DIR` 在 folder.constants（Task 3）、workspace-init（Task 21）、skill.manager（Task 18）、sync.service（Task 11）一致

---

## 执行选项

**Plan complete and saved to `docs/superpowers/plans/2026-08-31-remote-template-sync.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - 每个 Task 派发独立 subagent，任务间审查，快速迭代

**2. Inline Execution** - 当前会话顺序执行，按 checkpoint 批量审查

**选择哪种方式？**
