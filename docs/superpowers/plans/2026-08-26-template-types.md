# 模板类型扩展（Slash 模板 + 页面模板）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 扩展模板系统支持两种模板类型——slash 模板（编辑器斜杠命令插入）与 page 模板（文档模板，如产品需求说明书），内置常用文档模板并支持用户自定义；新增「新建页面」弹窗，支持选择模板或空白创建页面。

**Architecture:** 在 shared 层新增 `TEMPLATE_TYPE` 枚举（`slash` / `page`）；主进程按类型分文件存储（既有 `templates/slash/templates.json` + 新增 `templates/page/templates.json`，旧数据零迁移），IPC 四层（preload → api → ipcMain → service）全部增加 `type` 参数；renderer 侧新增内置页面模板清单（双语），`template.store` 按类型管理文件与合并结果；设置页按类型切换管理；新建页面弹窗将所选模板的 Markdown 作为 `content` 传给既有 `page.create` 链路（主进程页面服务零改动）。

**Tech Stack:** Electron IPC（4 层模式）、Vue 3 `<script setup>` + Pinia + Naive UI、SCSS、Vitest（happy-dom）。

**约束提醒（来自项目规则/记忆）：**
- `dev` 分支受保护：全程在 `feature/template-types` 分支提交，最后通过 PR 合入。
- `tsconfig.app.json` 开启 `noUnusedLocals` / `noUnusedParameters`：删除不再使用的 import（如 FileTree 中的 `PAGE_TYPE`）。
- 本仓库 `docs/` 被 gitignore：本计划文件不提交，仅作执行参考。
- 测试在 `tests/unit/` 下，`vue-tsc` 不检查测试文件（`tsconfig.vitest.json` 单独生效）。

---

## 关键设计决策

| 决策点 | 选择 | 理由 |
| --- | --- | --- |
| 类型建模 | 新增 `TEMPLATE_TYPE` 枚举（shared），不把 `type` 写入 `CustomTemplate` 存储 | 存储按类型分文件，类型由文件位置隐含；读取时 service 归一化，与现有 profession/icon 归一化模式一致 |
| 存储 | `templates/slash/templates.json`（既有，不动）+ `templates/page/templates.json`（新） | 旧用户数据零迁移；folder.constants 已预留 `templates/` 根目录层级 |
| 类型重命名 | `SlashTemplateFile` → `TemplateFile`，`SlashTemplateItem` → `TemplateItem`，`BuiltInTemplateDef` 移入 shared types | 引入第二种类型后旧命名语义错误；`BuiltInTemplateDef` 被 slash 与 page 两个清单共用 |
| 内置页面模板数量 | 5 个常用文档模板（PRD/技术设计/周报/阅读笔记/项目计划），双语 | 「常用的文档模板」；沿用 slash 内置模板的双语 `LocalizedText` 模式 |
| 页面模板与职业 | 内置页面模板带职业标签（仅设置页归类展示）；新建页面弹窗**不按职业过滤**（展示全部启用模板） | 文档模板跨职业通用；设置页复用现有职业过滤列 |
| 新建页面入口 | 文件树「+」按钮与节点「新建子页面」改为打开 `PageCreateModal`；`PageView.autoCreateFirstPage`（作品无页面时自动建首章）保持不变 | 需求明确「增加创建新页面弹窗」；自动建首章是加载期引导行为，弹窗会打断 |
| 模板选中行为 | 默认选「不使用模板」（空白页面）；选中模板且用户未手动改标题时，自动用模板标题填充标题输入框 | 贴合「可选模板创建或不选」；避免建出名为「新章节」的 PRD |
| `TemplateEditModal` | 不改动 | 保存动作由父组件（TemplateSettings）携带 `activeType` 路由，弹窗本身类型无关 |

## 文件结构

**新增：**
- `src/renderer/templates/builtin-page-templates.ts` — 内置页面文档模板清单（双语纯数据）
- `src/renderer/components/project/PageCreateModal.vue` — 新建页面弹窗（标题 + 模板选择）
- `tests/unit/renderer/builtin-page-templates.test.ts` — 内置页面模板结构校验

**修改：**
- `src/shared/enums/template.enums.ts` — 新增 `TEMPLATE_TYPE` + `isTemplateType`
- `src/shared/types/template.types.ts` — 类型重命名 + 移入 `BuiltInTemplateDef`
- `src/main/constants/folder.constants.ts` — `PAGE_TEMPLATES_DIR` / `PAGE_TEMPLATES_FILE`
- `src/main/core/services/template.service.ts` — 按类型分文件读写 + 类型校验
- `src/main/core/apis/template.api.ts`、`src/main/ipcMain/template.ipc.ts`、`src/main/preload/types/template.ts`、`src/main/preload/modules/template.ts` — 增加 `type` 参数
- `src/renderer/store/template.store.ts` — 按类型状态 + `allTemplates(type, locale)`
- `src/renderer/components/editor/slash/commands/templates.ts`、`template-merge.ts`、`registry.ts` — 类型重命名/导入调整
- `src/renderer/components/editor/slash/SlashMenu.vue` — 按 slash 类型取模板
- `src/renderer/components/settings/template/TemplateSettings.vue` — 类型切换 + 按类型操作
- `src/renderer/components/project/FileTree.vue` — 接入新建页面弹窗
- `src/shared/i18n/locales/zhCN.ts`、`enUS.ts` — 新文案
- `tests/unit/renderer/template-merge.test.ts`、`slash-templates.test.ts`、`tests/unit/main/template.api.test.ts` — 适配新类型/签名

**不改动：** `TemplateEditModal.vue`、page 域全部主进程代码（`page.api.ts` / `page.service.ts` 等）、`PageView.vue`。

---

### Task 0: 创建功能分支

**Files:** 无

- [ ] **Step 1: 从最新 dev 创建功能分支**

```bash
git checkout dev
git pull
git checkout -b feature/template-types
```

Expected: 切换到新分支 `feature/template-types`，工作区干净。

---

### Task 1: shared 层类型扩展 + 全链路类型重命名

纯类型层重构（无行为变化），重命名必须一次性覆盖所有引用文件，否则 `vue-tsc` 失败。

**Files:**
- Modify: `src/shared/enums/template.enums.ts`
- Modify: `src/shared/types/template.types.ts`
- Modify: `src/renderer/components/editor/slash/commands/templates.ts`（头部 import + 删除本地接口）
- Modify: `src/renderer/components/editor/slash/commands/template-merge.ts`
- Modify: `src/renderer/components/editor/slash/commands/registry.ts`
- Modify: `src/main/core/services/template.service.ts`、`src/main/core/apis/template.api.ts`、`src/main/ipcMain/template.ipc.ts`、`src/main/preload/types/template.ts`、`src/renderer/store/template.store.ts`、`src/renderer/components/settings/template/TemplateSettings.vue`（仅类型名替换）
- Modify: `tests/unit/renderer/template-merge.test.ts`、`tests/unit/renderer/slash-templates.test.ts`（类型名替换）

- [ ] **Step 1: 在 `src/shared/enums/template.enums.ts` 顶部（文件注释之后、`TEMPLATE_ICON_NAMES` 之前）新增模板类型枚举**

```ts
/** 模板类型：slash=斜杠命令模板；page=页面（文档）模板 */
export const TEMPLATE_TYPE = {
  /** 斜杠命令模板：在编辑器 Slash 菜单中选中后插入正文 */
  SLASH: "slash",
  /** 页面模板：新建页面时作为文档初始内容 */
  PAGE: "page",
} as const;

export type TemplateType = (typeof TEMPLATE_TYPE)[keyof typeof TEMPLATE_TYPE];

/** 全部模板类型（用于遍历/校验） */
export const TEMPLATE_TYPES: readonly TemplateType[] = [
  TEMPLATE_TYPE.SLASH,
  TEMPLATE_TYPE.PAGE,
];

/** 判断值是否为合法的模板类型 */
export function isTemplateType(value: unknown): value is TemplateType {
  return (
    typeof value === "string" &&
    (TEMPLATE_TYPES as readonly string[]).includes(value)
  );
}
```

- [ ] **Step 2: 重写 `src/shared/types/template.types.ts`（重命名 + 移入 `BuiltInTemplateDef`）**

完整新内容：

```ts
import type { Profession } from "@/shared/enums/profession.enums";
import type { TemplateIconName } from "@/shared/enums/template.enums";

/** 双语文本：zh 为简体中文，en 为英文 */
export interface LocalizedText {
  zh: string;
  en: string;
}

/** 自定义模板（用户创建，存于工作区 JSON；slash 与 page 按类型分文件存储） */
export interface CustomTemplate {
  id: string;
  title: string;
  description: string;
  /** 图标键（@vicons/material Filled 变体键名，见 shared/enums/template.enums.ts） */
  icon: string;
  /** Markdown 模板正文 */
  markdown: string;
  profession: Profession;
  enabled: boolean;
}

/** 工作区模板文件内容（templates/{slash|page}/templates.json 的顶层结构） */
export interface TemplateFile {
  /** 自定义模板列表 */
  customTemplates: CustomTemplate[];
  /** 被用户禁用的内置模板 id 黑名单 */
  disabledTemplateIds: string[];
}

/** 内置模板的纯数据定义（双语，renderer 侧按类型提供清单） */
export interface BuiltInTemplateDef {
  id: string;
  profession: Profession;
  title: LocalizedText;
  description: LocalizedText;
  /** 图标键（@vicons/material Filled 变体），见 shared/enums/template.enums.ts */
  icon: TemplateIconName;
  markdown: LocalizedText;
}

/** 合并后的模板项（内置已按当前语言解析；设置页、Slash 菜单与新建页面弹窗共用） */
export interface TemplateItem {
  id: string;
  title: string;
  description: string;
  /** 图标键（@vicons/material Filled 变体键名，见 shared/enums/template.enums.ts） */
  icon: string;
  markdown: string;
  profession: Profession;
  /** true=内置模板，false=自定义模板 */
  builtIn: boolean;
  enabled: boolean;
}
```

- [ ] **Step 3: 调整 `src/renderer/components/editor/slash/commands/templates.ts` 头部**

将第 1-20 行（import 块 + 本地 `BuiltInTemplateDef` 接口）替换为：

```ts
import type { CommandGroup, SlashCommand } from "./types";
import type {
  BuiltInTemplateDef,
  TemplateItem,
} from "@/shared/types/template.types";
import { insertMarkdownTemplate } from "./helpers";
import { resolveTemplateIcon } from "./template-icons";
```

同时把 `buildTemplateGroup` 签名中的 `items: SlashTemplateItem[]` 改为 `items: TemplateItem[]`（约第 456 行）。文件其余内容（18 个内置模板数组）不变。

- [ ] **Step 4: 重写 `src/renderer/components/editor/slash/commands/template-merge.ts`**

完整新内容：

```ts
import { LOCALE } from "@/shared/enums";
import type {
  BuiltInTemplateDef,
  TemplateFile,
  TemplateItem,
} from "@/shared/types/template.types";

/**
 * 把内置模板（按当前语言解析）+ 自定义模板合并为统一列表。
 * 自定义模板排前，内置模板在后。纯函数，便于测试。slash 与 page 模板共用。
 */
export function mergeTemplates(
  builtins: BuiltInTemplateDef[],
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
    profession: def.profession,
    builtIn: true,
    enabled: !disabled.has(def.id),
  }));

  const customItems: TemplateItem[] = (file?.customTemplates ?? []).map(
    (c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      icon: c.icon,
      markdown: c.markdown,
      profession: c.profession,
      builtIn: false,
      enabled: c.enabled,
    }),
  );

  return [...customItems, ...builtinItems];
}
```

- [ ] **Step 5: 更新 `src/renderer/components/editor/slash/commands/registry.ts`**

把 `import type { SlashTemplateItem } from "@/shared/types/template.types";` 改为 `import type { TemplateItem } from "@/shared/types/template.types";`，并把 `getCommandGroups` 参数 `templateItems: SlashTemplateItem[]` 改为 `templateItems: TemplateItem[]`。

- [ ] **Step 6: 机械替换其余 6 个 src 文件中的类型名（仅改名，不动逻辑）**

| 文件 | 替换（replace_all） |
| --- | --- |
| `src/main/core/services/template.service.ts` | `SlashTemplateFile` → `TemplateFile`（import、`DEFAULT_FILE`、全部签名，共 8 处） |
| `src/main/core/apis/template.api.ts` | `SlashTemplateFile` → `TemplateFile`（共 6 处） |
| `src/main/ipcMain/template.ipc.ts` | `SlashTemplateFile` → `TemplateFile`（共 6 处） |
| `src/main/preload/types/template.ts` | `SlashTemplateFile` → `TemplateFile`（共 6 处） |
| `src/renderer/store/template.store.ts` | `SlashTemplateFile` → `TemplateFile`；`SlashTemplateItem` → `TemplateItem` |
| `src/renderer/components/settings/template/TemplateSettings.vue` | `SlashTemplateItem` → `TemplateItem`（含 import 与全部类型标注） |

- [ ] **Step 7: 更新两个测试文件的类型名**

- `tests/unit/renderer/template-merge.test.ts`：`import type { SlashTemplateFile }` → `import type { TemplateFile }`，`const FILE: SlashTemplateFile` → `const FILE: TemplateFile`
- `tests/unit/renderer/slash-templates.test.ts`：`import type { SlashTemplateItem }` → `import type { TemplateItem }`，`const items: SlashTemplateItem[]` → `const items: TemplateItem[]`

- [ ] **Step 8: 运行 typecheck 与全量测试验证**

```bash
pnpm typecheck
pnpm test
```

Expected: typecheck 0 错误；全部测试 PASS（纯重命名，无行为变化）。

- [ ] **Step 9: Commit**

```bash
git add src/shared src/main src/renderer tests
git commit -m "refactor(template): rename template types and add TEMPLATE_TYPE enum"
```

---

### Task 2: 内置页面模板数据（TDD）

**Files:**
- Create: `src/renderer/templates/builtin-page-templates.ts`
- Test: `tests/unit/renderer/builtin-page-templates.test.ts`

- [ ] **Step 1: 写失败测试 `tests/unit/renderer/builtin-page-templates.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { PROFESSION } from "@/shared/enums/profession.enums";
import { isTemplateIconName } from "@/shared/enums/template.enums";
import { builtinPageTemplates } from "@/renderer/templates/builtin-page-templates";

describe("内置页面模板", () => {
  it("内置页面模板均带有效职业标签", () => {
    for (const tpl of builtinPageTemplates) {
      expect(Object.values(PROFESSION)).toContain(tpl.profession);
    }
  });

  it("内置页面模板 id 唯一且带 page- 前缀（与 slash 内置 id 隔离）", () => {
    const ids = builtinPageTemplates.map((tpl) => tpl.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id.startsWith("page-")).toBe(true);
    }
  });

  it("内置页面模板图标均为合法图标键", () => {
    for (const tpl of builtinPageTemplates) {
      expect(isTemplateIconName(tpl.icon)).toBe(true);
    }
  });

  it("内置页面模板标题/描述/正文均为中英双语", () => {
    for (const tpl of builtinPageTemplates) {
      expect(tpl.title.zh.length).toBeGreaterThan(0);
      expect(tpl.title.en.length).toBeGreaterThan(0);
      expect(tpl.description.zh.length).toBeGreaterThan(0);
      expect(tpl.description.en.length).toBeGreaterThan(0);
      expect(tpl.markdown.zh.length).toBeGreaterThan(0);
      expect(tpl.markdown.en.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm exec vitest run tests/unit/renderer/builtin-page-templates.test.ts
```

Expected: FAIL — `Failed to resolve import "@/renderer/templates/builtin-page-templates"`（模块不存在）。

- [ ] **Step 3: 创建 `src/renderer/templates/builtin-page-templates.ts`**

完整内容（5 个常用文档模板，双语）：

```ts
import type { BuiltInTemplateDef } from "@/shared/types/template.types";

/**
 * 内置页面模板清单（文档模板）。
 * 用于「新建页面」弹窗：选中后模板 Markdown 作为新页面的初始内容。
 * 与 slash 内置模板一致采用 { zh, en } 双语字面量；profession 仅用于设置页归类展示，
 * 新建页面弹窗不按职业过滤（文档模板对所有职业通用）。
 */
export const builtinPageTemplates: BuiltInTemplateDef[] = [
  {
    id: "page-prd",
    profession: "pm",
    title: { zh: "产品需求说明书", en: "Product Requirements Document" },
    description: {
      zh: "标准 PRD 文档骨架",
      en: "Standard PRD document skeleton",
    },
    icon: "fact_check",
    markdown: {
      zh: `# 产品需求说明书（PRD）

## 文档信息

- 产品名称：{产品名称}
- 作者：{姓名}
- 日期：{日期}
- 版本：v0.1

## 背景与目标

### 背景

### 目标

### 非目标

## 用户与场景

- 目标用户：
- 核心场景：

## 功能需求

| 编号 | 功能 | 优先级 | 描述 |
| --- | --- | --- | --- |
| F1 |  | P0 |  |

### 功能详情：F1 {功能名称}

- 用户故事：作为{角色}，我希望{功能}，以便{价值}
- 交互流程：
- 边界条件：

## 非功能需求

- 性能：
- 兼容性：
- 安全：

## 里程碑

| 阶段 | 内容 | 时间 |
| --- | --- | --- |
|  |  |  |

## 开放问题

- [ ] 
`,
      en: `# Product Requirements Document (PRD)

## Document Info

- Product: {product name}
- Author: {name}
- Date: {date}
- Version: v0.1

## Background & Goals

### Background

### Goals

### Non-Goals

## Users & Scenarios

- Target users:
- Key scenarios:

## Functional Requirements

| ID | Feature | Priority | Description |
| --- | --- | --- | --- |
| F1 |  | P0 |  |

### Feature Detail: F1 {feature name}

- User story: As a {role}, I want {feature}, so that {value}
- Interaction flow:
- Edge cases:

## Non-Functional Requirements

- Performance:
- Compatibility:
- Security:

## Milestones

| Phase | Scope | Date |
| --- | --- | --- |
|  |  |  |

## Open Questions

- [ ] 
`,
    },
  },
  {
    id: "page-tech-design",
    profession: "developer",
    title: { zh: "技术设计文档", en: "Technical Design Document" },
    description: {
      zh: "技术方案与接口设计骨架",
      en: "Technical solution and API design skeleton",
    },
    icon: "code",
    markdown: {
      zh: `# 技术设计文档

## 背景与目标

- 需求：
- 目标：

## 总体方案

- 方案概述：
- 备选方案对比：

## 详细设计

### 模块划分

### 数据结构

### 接口设计

| 接口 | 方法 | 入参 | 出参 | 说明 |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

### 关键流程

## 异常与兼容

- 异常处理：
- 兼容性：

## 测试计划

- [ ] 单元测试：
- [ ] 集成测试：

## 上线计划
`,
      en: `# Technical Design Document

## Background & Goals

- Requirement:
- Goals:

## Overall Solution

- Summary:
- Alternatives:

## Detailed Design

### Modules

### Data Structures

### API Design

| API | Method | Input | Output | Notes |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

### Key Flows

## Errors & Compatibility

- Error handling:
- Compatibility:

## Test Plan

- [ ] Unit tests:
- [ ] Integration tests:

## Release Plan
`,
    },
  },
  {
    id: "page-weekly-report",
    profession: "general",
    title: { zh: "项目周报", en: "Weekly Report" },
    description: {
      zh: "周进展与风险汇报骨架",
      en: "Weekly progress and risk report skeleton",
    },
    icon: "summarize",
    markdown: {
      zh: `# 项目周报

- 周期：{起始日期} ~ {结束日期}
- 汇报人：

## 本周进展

| 事项 | 状态 | 说明 |
| --- | --- | --- |
|  | 进行中 |  |

## 数据与指标

## 问题与风险

- 风险：
- 需要的支持：

## 下周计划

- [ ] 

## 备注
`,
      en: `# Weekly Report

- Period: {start date} ~ {end date}
- Reporter:

## Progress This Week

| Item | Status | Notes |
| --- | --- | --- |
|  | In progress |  |

## Metrics

## Issues & Risks

- Risks:
- Support needed:

## Plan for Next Week

- [ ] 

## Notes
`,
    },
  },
  {
    id: "page-reading-notes",
    profession: "general",
    title: { zh: "阅读笔记", en: "Reading Notes" },
    description: {
      zh: "书籍阅读记录与摘录骨架",
      en: "Book notes with excerpts skeleton",
    },
    icon: "note_alt",
    markdown: {
      zh: `# 阅读笔记：《{书名}》

- 作者：
- 阅读日期：
- 评分：⭐⭐⭐⭐⭐

## 一句话总结

## 核心观点

1. 
2. 
3. 

## 摘录与批注

> {原文摘录}

批注：

## 读后感

## 行动清单

- [ ] 
`,
      en: `# Reading Notes: {Book Title}

- Author:
- Date:
- Rating: ⭐⭐⭐⭐⭐

## One-Sentence Summary

## Key Ideas

1. 
2. 
3. 

## Excerpts & Comments

> {excerpt}

Comment:

## Reflections

## Action Items

- [ ] 
`,
    },
  },
  {
    id: "page-project-plan",
    profession: "pm",
    title: { zh: "项目计划书", en: "Project Plan" },
    description: {
      zh: "项目目标、里程碑与分工骨架",
      en: "Project goals, milestones and staffing skeleton",
    },
    icon: "task_alt",
    markdown: {
      zh: `# 项目计划书

## 项目概述

- 项目名称：
- 项目目标：
- 关键成功指标：

## 范围

- 包含：
- 不包含：

## 里程碑计划

| 里程碑 | 交付物 | 截止日期 | 负责人 |
| --- | --- | --- | --- |
| M1 |  |  |  |

## 资源与分工

| 成员 | 职责 |
| --- | --- |
|  |  |

## 风险与应对

| 风险 | 影响 | 应对措施 |
| --- | --- | --- |
|  |  |  |

## 沟通机制

- 周会：
- 文档：
`,
      en: `# Project Plan

## Overview

- Project name:
- Goals:
- Key success metrics:

## Scope

- In scope:
- Out of scope:

## Milestones

| Milestone | Deliverable | Due Date | Owner |
| --- | --- | --- | --- |
| M1 |  |  |  |

## Team & Responsibilities

| Member | Responsibility |
| --- | --- |
|  |  |

## Risks & Mitigation

| Risk | Impact | Mitigation |
| --- | --- | --- |
|  |  |  |

## Communication

- Weekly meeting:
- Documentation:
`,
    },
  },
];
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm exec vitest run tests/unit/renderer/builtin-page-templates.test.ts
```

Expected: PASS（4 个用例）。

- [ ] **Step 5: Commit**

```bash
git add src/renderer/templates tests/unit/renderer/builtin-page-templates.test.ts
git commit -m "feat(template): add built-in page document templates"
```

---

### Task 3: 按类型分文件存储 + IPC 全链路 type 参数 + store 重构

本任务完成后：主进程按类型读写两个 JSON 文件；renderer store 按类型管理；SlashMenu 与 TemplateSettings 以 slash 类型调用（保持既有行为）；页面模板数据链路就绪。

**Files:**
- Modify: `src/main/constants/folder.constants.ts`
- Modify: `src/main/core/services/template.service.ts`
- Modify: `src/main/core/apis/template.api.ts`
- Modify: `src/main/ipcMain/template.ipc.ts`
- Modify: `src/main/preload/types/template.ts`、`src/main/preload/modules/template.ts`
- Modify: `src/renderer/store/template.store.ts`
- Modify: `src/renderer/components/editor/slash/SlashMenu.vue`
- Modify: `src/renderer/components/settings/template/TemplateSettings.vue`（最小适配）
- Modify: `tests/unit/main/template.api.test.ts`

- [ ] **Step 1: `src/main/constants/folder.constants.ts` 追加页面模板常量**

在 `SLASH_TEMPLATES_FILE` 之后追加：

```ts
/** Page 模板子文件夹 */
export const PAGE_TEMPLATES_DIR = "page" as const;

/** Page 模板文件名 */
export const PAGE_TEMPLATES_FILE = "templates.json" as const;
```

- [ ] **Step 2: 重写 `src/main/core/services/template.service.ts`**

完整新内容（方法全部接收 `type`；`saveTemplatesFile` 收窄为 private——已确认无外部调用方）：

```ts
import fs from "fs";
import path from "path";
import { configService } from "@/main/core/services/config.service";
import {
  TEMPLATES_DIR,
  SLASH_TEMPLATES_DIR,
  SLASH_TEMPLATES_FILE,
  PAGE_TEMPLATES_DIR,
  PAGE_TEMPLATES_FILE,
} from "@/main/constants/folder.constants";
import type {
  CustomTemplate,
  TemplateFile,
} from "@/shared/types/template.types";
import type { TemplateType } from "@/shared/enums/template.enums";
import { PROFESSION } from "@/shared/enums";
import {
  DEFAULT_TEMPLATE_ICON,
  isTemplateIconName,
  isTemplateType,
  TEMPLATE_TYPE,
} from "@/shared/enums/template.enums";
import { Logger } from "@/main/utils/logger";

const DEFAULT_FILE: TemplateFile = {
  customTemplates: [],
  disabledTemplateIds: [],
};

class TemplateService {
  private static instance: TemplateService | null = null;

  private constructor() { }

  public static getInstance(): TemplateService {
    if (!TemplateService.instance) {
      TemplateService.instance = new TemplateService();
    }
    return TemplateService.instance;
  }

  private getWorkspacePath(): string {
    const ws = (globalThis as Record<string, unknown>)
      .__WRISP_WORKSPACE_PATH__ as string | undefined;
    if (ws && ws.trim() !== "") return ws;
    return configService.getValue<string>("workspace") || "";
  }

  /** 模板类型 → 子目录/文件名（slash 与 page 分文件存储，互不影响） */
  private getFilePath(type: TemplateType): string {
    const dir =
      type === TEMPLATE_TYPE.SLASH ? SLASH_TEMPLATES_DIR : PAGE_TEMPLATES_DIR;
    const fileName =
      type === TEMPLATE_TYPE.SLASH
        ? SLASH_TEMPLATES_FILE
        : PAGE_TEMPLATES_FILE;
    return path.join(this.getWorkspacePath(), TEMPLATES_DIR, dir, fileName);
  }

  /** IPC 入参不受类型系统保护，运行时校验防止非法值拼进文件路径 */
  private assertValidType(type: TemplateType): void {
    if (!isTemplateType(type)) {
      throw new Error(`非法模板类型: ${String(type)}`);
    }
  }

  /** 读取指定类型的模板文件；文件缺失或损坏时返回默认值 */
  public getTemplatesFile(type: TemplateType): TemplateFile {
    this.assertValidType(type);
    const filePath = this.getFilePath(type);
    try {
      if (!fs.existsSync(filePath)) return { ...DEFAULT_FILE };
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw) as TemplateFile;
      return {
        customTemplates: Array.isArray(data.customTemplates)
          ? data.customTemplates.map((c) => ({
            ...c,
            // 读取时统一为 custom 职业：旧版本自定义模板可能存了其他职业，
            // 仅 custom 职业的模板具备编辑/删除入口，避免历史数据被锁死
            profession: PROFESSION.CUSTOM,
            // 旧版本自定义模板的 icon 可能是 emoji 或内联 HTML，
            // 现在统一为 @vicons/material 图标键，非法键回退到默认图标
            icon: isTemplateIconName(c.icon) ? c.icon : DEFAULT_TEMPLATE_ICON,
          }))
          : [],
        disabledTemplateIds: Array.isArray(data.disabledTemplateIds)
          ? data.disabledTemplateIds
          : [],
      };
    } catch (error) {
      Logger.error("读取模板文件失败", {
        error: String(error),
        filePath,
        type,
      });
      return { ...DEFAULT_FILE };
    }
  }

  /** 写入指定类型的模板文件 */
  private saveTemplatesFile(type: TemplateType, file: TemplateFile): void {
    const filePath = this.getFilePath(type);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(file, null, 2), "utf-8");
  }

  /** 新增或按 id 更新自定义模板，返回最新文件 */
  public upsertCustomTemplate(
    type: TemplateType,
    tpl: CustomTemplate,
  ): TemplateFile {
    const file = this.getTemplatesFile(type);
    const idx = file.customTemplates.findIndex((c) => c.id === tpl.id);
    if (idx >= 0) file.customTemplates[idx] = tpl;
    else file.customTemplates.push(tpl);
    this.saveTemplatesFile(type, file);
    return file;
  }

  /** 按 id 删除自定义模板，返回最新文件 */
  public deleteCustomTemplate(type: TemplateType, id: string): TemplateFile {
    const file = this.getTemplatesFile(type);
    file.customTemplates = file.customTemplates.filter((c) => c.id !== id);
    this.saveTemplatesFile(type, file);
    return file;
  }

  /** 设置模板启用状态：内置走黑名单；自定义写 enabled 字段，返回最新文件 */
  public setTemplateEnabled(
    type: TemplateType,
    id: string,
    builtIn: boolean,
    enabled: boolean,
  ): TemplateFile {
    const file = this.getTemplatesFile(type);
    if (builtIn) {
      const disabled = new Set(file.disabledTemplateIds);
      if (enabled) disabled.delete(id);
      else disabled.add(id);
      file.disabledTemplateIds = [...disabled];
    } else {
      const target = file.customTemplates.find((c) => c.id === id);
      if (target) target.enabled = enabled;
    }
    this.saveTemplatesFile(type, file);
    return file;
  }
}

export const templateService = TemplateService.getInstance();
```

- [ ] **Step 3: 重写 `src/main/core/apis/template.api.ts`**

```ts
import { templateService } from "@/main/core/services/template.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type { TemplateType } from "@/shared/enums/template.enums";
import type {
  ApiResponse,
  CustomTemplate,
  TemplateFile,
} from "@/shared/types";
import { Logger } from "@/main/utils/logger";

async function getFile(
  type: TemplateType,
): Promise<ApiResponse<TemplateFile>> {
  try {
    return response.success(templateService.getTemplatesFile(type));
  } catch (error) {
    Logger.error("获取模板失败", { error: String(error), type });
    return response.error(ErrorCode.TEMPLATE_GET_FAILED, error as Error);
  }
}

async function upsertCustom(
  type: TemplateType,
  tpl: CustomTemplate,
): Promise<ApiResponse<TemplateFile>> {
  try {
    return response.success(templateService.upsertCustomTemplate(type, tpl));
  } catch (error) {
    Logger.error("保存模板失败", { error: String(error), type });
    return response.error(ErrorCode.TEMPLATE_SAVE_FAILED, error as Error);
  }
}

async function deleteCustom(
  type: TemplateType,
  id: string,
): Promise<ApiResponse<TemplateFile>> {
  try {
    return response.success(templateService.deleteCustomTemplate(type, id));
  } catch (error) {
    Logger.error("删除模板失败", { error: String(error), type });
    return response.error(ErrorCode.TEMPLATE_DELETE_FAILED, error as Error);
  }
}

async function setEnabled(
  type: TemplateType,
  id: string,
  builtIn: boolean,
  enabled: boolean,
): Promise<ApiResponse<TemplateFile>> {
  try {
    return response.success(
      templateService.setTemplateEnabled(type, id, builtIn, enabled),
    );
  } catch (error) {
    Logger.error("更新模板启用状态失败", { error: String(error), type });
    return response.error(ErrorCode.TEMPLATE_SAVE_FAILED, error as Error);
  }
}

export { getFile, upsertCustom, deleteCustom, setEnabled };
```

- [ ] **Step 4: 重写 `src/main/ipcMain/template.ipc.ts`**

```ts
import { ipcMain } from "electron";
import {
  getFile,
  upsertCustom,
  deleteCustom,
  setEnabled,
} from "@/main/core/apis/template.api";
import type { ApiResponse } from "@/shared/types";
import type { TemplateType } from "@/shared/enums/template.enums";
import type {
  CustomTemplate,
  TemplateFile,
} from "@/shared/types/template.types";

export function registerTemplateHandlers() {
  ipcMain.handle(
    "template:getFile",
    async (_, type: TemplateType): Promise<ApiResponse<TemplateFile>> => {
      return getFile(type);
    },
  );

  ipcMain.handle(
    "template:upsertCustom",
    async (
      _,
      type: TemplateType,
      tpl: CustomTemplate,
    ): Promise<ApiResponse<TemplateFile>> => {
      return upsertCustom(type, tpl);
    },
  );

  ipcMain.handle(
    "template:deleteCustom",
    async (
      _,
      type: TemplateType,
      id: string,
    ): Promise<ApiResponse<TemplateFile>> => {
      return deleteCustom(type, id);
    },
  );

  ipcMain.handle(
    "template:setEnabled",
    async (
      _,
      type: TemplateType,
      id: string,
      builtIn: boolean,
      enabled: boolean,
    ): Promise<ApiResponse<TemplateFile>> => {
      return setEnabled(type, id, builtIn, enabled);
    },
  );
}
```

- [ ] **Step 5: 重写 `src/main/preload/types/template.ts`**

```ts
import type { ApiResponse } from "@/shared/types";
import type { TemplateType } from "@/shared/enums/template.enums";
import type {
  CustomTemplate,
  TemplateFile,
} from "@/shared/types/template.types";

export interface TemplateAPI {
  getFile: (type: TemplateType) => Promise<ApiResponse<TemplateFile>>;
  upsertCustom: (
    type: TemplateType,
    tpl: CustomTemplate,
  ) => Promise<ApiResponse<TemplateFile>>;
  deleteCustom: (
    type: TemplateType,
    id: string,
  ) => Promise<ApiResponse<TemplateFile>>;
  setEnabled: (
    type: TemplateType,
    id: string,
    builtIn: boolean,
    enabled: boolean,
  ) => Promise<ApiResponse<TemplateFile>>;
}
```

- [ ] **Step 6: 重写 `src/main/preload/modules/template.ts`**

```ts
import { ipcRenderer } from "electron";
import type { TemplateAPI } from "../types/template";

export const templateModule: TemplateAPI = {
  getFile: (type) => ipcRenderer.invoke("template:getFile", type),
  upsertCustom: (type, tpl) =>
    ipcRenderer.invoke("template:upsertCustom", type, tpl),
  deleteCustom: (type, id) =>
    ipcRenderer.invoke("template:deleteCustom", type, id),
  setEnabled: (type, id, builtIn, enabled) =>
    ipcRenderer.invoke("template:setEnabled", type, id, builtIn, enabled),
};
```

- [ ] **Step 7: 重写 `src/renderer/store/template.store.ts`**

```ts
import { ref } from "vue";
import { defineStore } from "pinia";
import type {
  CustomTemplate,
  TemplateFile,
  TemplateItem,
} from "@/shared/types/template.types";
import {
  TEMPLATE_TYPE,
  type TemplateType,
} from "@/shared/enums/template.enums";
import { builtinTemplates } from "@/renderer/components/editor/slash/commands/templates";
import { builtinPageTemplates } from "@/renderer/templates/builtin-page-templates";
import { mergeTemplates } from "@/renderer/components/editor/slash/commands/template-merge";

export const useTemplateStore = defineStore("template", () => {
  /** 各类型的工作区模板文件（slash / page 分文件，按类型懒加载） */
  const files = ref<Record<TemplateType, TemplateFile | null>>({
    [TEMPLATE_TYPE.SLASH]: null,
    [TEMPLATE_TYPE.PAGE]: null,
  });
  const loading = ref<Record<TemplateType, boolean>>({
    [TEMPLATE_TYPE.SLASH]: false,
    [TEMPLATE_TYPE.PAGE]: false,
  });

  /** 指定类型是否已从主进程成功加载过（避免重复拉取） */
  function isLoaded(type: TemplateType): boolean {
    return files.value[type] !== null;
  }

  /** 拉取指定类型的模板文件（已加载或加载中则跳过） */
  async function fetch(type: TemplateType): Promise<void> {
    if (loading.value[type] || files.value[type]) return;
    loading.value[type] = true;
    try {
      const res = await window.electronAPI.template.getFile(type);
      if (res.success && res.data) {
        files.value[type] = res.data;
      }
    } finally {
      loading.value[type] = false;
    }
  }

  /** 新增或更新自定义模板，成功后同步本地对应类型的文件 */
  async function saveCustom(
    type: TemplateType,
    tpl: CustomTemplate,
  ): Promise<boolean> {
    const res = await window.electronAPI.template.upsertCustom(type, tpl);
    if (res.success && res.data) {
      files.value[type] = res.data;
      return true;
    }
    return false;
  }

  /** 删除自定义模板 */
  async function removeCustom(
    type: TemplateType,
    id: string,
  ): Promise<boolean> {
    const res = await window.electronAPI.template.deleteCustom(type, id);
    if (res.success && res.data) {
      files.value[type] = res.data;
      return true;
    }
    return false;
  }

  /** 设置启用状态（内置 builtIn=true 走黑名单；自定义 false 走 enabled 字段） */
  async function setEnabled(
    type: TemplateType,
    id: string,
    builtIn: boolean,
    enabled: boolean,
  ): Promise<boolean> {
    const res = await window.electronAPI.template.setEnabled(
      type,
      id,
      builtIn,
      enabled,
    );
    if (res.success && res.data) {
      files.value[type] = res.data;
      return true;
    }
    return false;
  }

  /**
   * 合并后的全部模板（内置按当前语言解析）。
   * slash 类型用 Slash 菜单清单；page 类型用页面文档清单。
   */
  function allTemplates(type: TemplateType, locale: string): TemplateItem[] {
    const builtins =
      type === TEMPLATE_TYPE.SLASH ? builtinTemplates : builtinPageTemplates;
    return mergeTemplates(builtins, files.value[type], locale);
  }

  return {
    files,
    isLoaded,
    fetch,
    saveCustom,
    removeCustom,
    setEnabled,
    allTemplates,
  };
});
```

- [ ] **Step 8: 适配 `src/renderer/components/editor/slash/SlashMenu.vue`**

三处修改：

1. import 区新增（放在 `PROFESSION` import 之后）：

```ts
import { TEMPLATE_TYPE } from "@/shared/enums/template.enums";
```

2. onMounted（约第 59-61 行）：

```ts
onMounted(() => {
  if (!templateStore.isLoaded(TEMPLATE_TYPE.SLASH)) {
    templateStore.fetch(TEMPLATE_TYPE.SLASH);
  }
});
```

3. `commandGroups` computed（约第 71-82 行）首行改为：

```ts
const items = templateStore
  .allTemplates(TEMPLATE_TYPE.SLASH, locale.value)
  .filter(
```

（`.filter` 的职业过滤逻辑保持不变。）

- [ ] **Step 9: 最小适配 `src/renderer/components/settings/template/TemplateSettings.vue`（暂固定 slash 类型，Task 5 再加切换）**

1. import 区新增：`import { TEMPLATE_TYPE } from "@/shared/enums/template.enums";`
2. 第 54 行 `if (!store.loaded) store.fetch();` 改为：

```ts
if (!store.isLoaded(TEMPLATE_TYPE.SLASH)) store.fetch(TEMPLATE_TYPE.SLASH);
```

3. `allTemplates` computed 改为：

```ts
const allTemplates = computed<TemplateItem[]>(() =>
  store.allTemplates(TEMPLATE_TYPE.SLASH, locale.value),
);
```

4. `onSave` 中 `store.saveCustom(tpl)` → `store.saveCustom(TEMPLATE_TYPE.SLASH, tpl)`
5. `onDelete` 中 `store.removeCustom(row.id)` → `store.removeCustom(TEMPLATE_TYPE.SLASH, row.id)`
6. `onToggle` 中 `store.setEnabled(row.id, row.builtIn, enabled)` → `store.setEnabled(TEMPLATE_TYPE.SLASH, row.id, row.builtIn, enabled)`

- [ ] **Step 10: 更新 `tests/unit/main/template.api.test.ts`**

完整新内容（mock 方法名与签名同步；新增按类型调用与非法类型用例）：

```ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from "vitest";

// ── Mocks ──
vi.mock("@/main/utils/logger", () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}))
vi.mock("winston", () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  format: { combine: vi.fn(), timestamp: vi.fn(), printf: vi.fn(), colorize: vi.fn(), simple: vi.fn(), json: vi.fn() },
  transports: { Console: vi.fn(), File: vi.fn() },
  addColors: vi.fn(),
}))
vi.mock("winston-daily-rotate-file", () => ({ default: vi.fn() }))

// ── Mock templateService ──
const mockTemplateService = vi.hoisted(() => {
  const file = {
    customTemplates: [
      {
        id: "custom_1",
        title: "我的模板",
        description: "自定义模板",
        icon: "description",
        markdown: "# 自定义",
        profession: "custom",
        enabled: true,
      },
    ],
    disabledTemplateIds: ["todo"],
  } as const

  return {
    getTemplatesFile: vi.fn(() => file),
    upsertCustomTemplate: vi.fn(() => file),
    deleteCustomTemplate: vi.fn(() => file),
    setTemplateEnabled: vi.fn(() => file),
  }
})

vi.mock("@/main/core/services/template.service", () => ({
  templateService: mockTemplateService,
  default: vi.fn(() => mockTemplateService),
}))

import {
  getFile,
  upsertCustom,
  deleteCustom,
  setEnabled,
} from "@/main/core/apis/template.api"
import { ErrorCode } from "@/shared/enums"
import { TEMPLATE_TYPE } from "@/shared/enums/template.enums"
import type { TemplateType } from "@/shared/enums/template.enums"
import type { CustomTemplate } from "@/shared/types/template.types"

describe("Template API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("getFile 按 slash 类型返回成功响应与文件数据", async () => {
    const res = await getFile(TEMPLATE_TYPE.SLASH)
    expect(res.success).toBe(true)
    expect(mockTemplateService.getTemplatesFile).toHaveBeenCalledWith(TEMPLATE_TYPE.SLASH)
    expect(res.data).toEqual(mockTemplateService.getTemplatesFile())
  })

  it("getFile 支持 page 类型", async () => {
    const res = await getFile(TEMPLATE_TYPE.PAGE)
    expect(res.success).toBe(true)
    expect(mockTemplateService.getTemplatesFile).toHaveBeenCalledWith(TEMPLATE_TYPE.PAGE)
  })

  it("upsertCustom 调用 service 并返回成功响应", async () => {
    const tpl: CustomTemplate = {
      id: "custom_new",
      title: "新模板",
      description: "",
      icon: "description",
      markdown: "# 新",
      profession: "custom",
      enabled: true,
    }
    const res = await upsertCustom(TEMPLATE_TYPE.PAGE, tpl)
    expect(mockTemplateService.upsertCustomTemplate).toHaveBeenCalledWith(TEMPLATE_TYPE.PAGE, tpl)
    expect(res.success).toBe(true)
  })

  it("deleteCustom 调用 service 并返回成功响应", async () => {
    const res = await deleteCustom(TEMPLATE_TYPE.SLASH, "custom_1")
    expect(mockTemplateService.deleteCustomTemplate).toHaveBeenCalledWith(TEMPLATE_TYPE.SLASH, "custom_1")
    expect(res.success).toBe(true)
  })

  it("setEnabled 调用 service 并返回成功响应", async () => {
    const res = await setEnabled(TEMPLATE_TYPE.SLASH, "todo", true, false)
    expect(mockTemplateService.setTemplateEnabled).toHaveBeenCalledWith(TEMPLATE_TYPE.SLASH, "todo", true, false)
    expect(res.success).toBe(true)
  })

  it("service 抛错时 getFile 返回模板错误码", async () => {
    mockTemplateService.getTemplatesFile.mockImplementation(() => {
      throw new Error("boom")
    })
    const res = await getFile(TEMPLATE_TYPE.SLASH)
    expect(res.success).toBe(false)
    expect(res.code).toBe(ErrorCode.TEMPLATE_GET_FAILED)
  })

  it("service 抛错（如非法类型被拦截）时 upsertCustom 返回错误响应", async () => {
    mockTemplateService.upsertCustomTemplate.mockImplementation(() => {
      throw new Error("invalid type")
    })
    const tpl: CustomTemplate = {
      id: "custom_bad",
      title: "坏类型",
      description: "",
      icon: "description",
      markdown: "# 坏",
      profession: "custom",
      enabled: true,
    }
    const res = await upsertCustom("../etc" as TemplateType, tpl)
    expect(res.success).toBe(false)
    expect(res.code).toBe(ErrorCode.TEMPLATE_SAVE_FAILED)
  })
})
```

- [ ] **Step 11: 运行 typecheck 与全量测试**

```bash
pnpm typecheck
pnpm test
```

Expected: typecheck 0 错误；全部测试 PASS（含更新后的 Template API 7 个用例）。

- [ ] **Step 12: Commit**

```bash
git add src/main src/renderer tests
git commit -m "feat(template): store templates per type across IPC layers"
```

---

### Task 4: i18n 文案（zh + en）

**Files:**
- Modify: `src/shared/i18n/locales/zhCN.ts`（TEMPLATE_SETTINGS 约 239-260 行；TIPS.PAGE 约 150-155 行）
- Modify: `src/shared/i18n/locales/enUS.ts`（TEMPLATE_SETTINGS 约 241-262 行；TIPS.PAGE 约 152-157 行）

- [ ] **Step 1: zhCN.ts — TEMPLATE_SETTINGS 区块**

1. `DESC` 值改为 `"管理 Slash 菜单与新建页面使用的模板，内置模板支持中英双语"`。
2. 在 `TYPE: "类型",` 之后插入两行：

```ts
      TYPE_SLASH: "Slash 模板",
      TYPE_PAGE: "页面模板",
```

- [ ] **Step 2: zhCN.ts — TIPS.PAGE 区块整体替换为**

```ts
    PAGE: {
      NO_PAGE_SELECTED: "请在左侧文件树中选择章节开始创作",
      NEW_CHAPTER: "新章节",
      CONFIRM_DELETE: "确定删除该页面？删除后不可恢复",
      CATALOG_EMPTY: "暂无目录",
      CREATE_TITLE: "新建页面",
      PAGE_TITLE: "页面标题",
      INPUT_PAGE_TITLE: "请输入页面标题",
      SELECT_TEMPLATE: "选择模板",
      NO_TEMPLATE: "不使用模板",
      NO_TEMPLATE_DESC: "创建空白页面",
    },
```

- [ ] **Step 3: enUS.ts — TEMPLATE_SETTINGS 区块**

1. `DESC` 值改为 `"Manage templates for the Slash menu and new pages. Built-in templates support both Chinese and English"`。
2. 在 `TYPE: "Type",` 之后插入：

```ts
      TYPE_SLASH: "Slash Templates",
      TYPE_PAGE: "Page Templates",
```

- [ ] **Step 4: enUS.ts — TIPS.PAGE 区块整体替换为**

```ts
    PAGE: {
      NO_PAGE_SELECTED: "Select a chapter from the file tree to start writing",
      NEW_CHAPTER: "New Chapter",
      CONFIRM_DELETE: "Delete this page? This cannot be undone.",
      CATALOG_EMPTY: "No catalog yet",
      CREATE_TITLE: "New Page",
      PAGE_TITLE: "Page Title",
      INPUT_PAGE_TITLE: "Please enter a page title",
      SELECT_TEMPLATE: "Template",
      NO_TEMPLATE: "No Template",
      NO_TEMPLATE_DESC: "Create a blank page",
    },
```

- [ ] **Step 5: 验证 typecheck 通过后 Commit**

```bash
pnpm typecheck
git add src/shared/i18n
git commit -m "feat(i18n): add template type and page create texts"
```

---

### Task 5: 设置页按类型切换管理模板

**Files:**
- Modify: `src/renderer/components/settings/template/TemplateSettings.vue`

- [ ] **Step 1: 模板区新增类型 Tab 切换**

在标题行 `</n-flex>`（第 11 行）与职业过滤行 `<n-flex align="center" :size="8">`（第 13 行）之间插入（`n-tabs` 仅作切换器，职业过滤与表格在 Tab 下方共用）：

```vue
    <n-tabs v-model:value="activeType" type="line" size="small">
      <n-tab :name="TEMPLATE_TYPE.SLASH"
        :tab="t('SETTINGS.TEMPLATE_SETTINGS.TYPE_SLASH')" />
      <n-tab :name="TEMPLATE_TYPE.PAGE"
        :tab="t('SETTINGS.TEMPLATE_SETTINGS.TYPE_PAGE')" />
    </n-tabs>
```

- [ ] **Step 2: script 区改造**

1. import 区新增/调整：

```ts
import { ref, computed, h, watch } from "vue";
```

```ts
import {
  TEMPLATE_TYPE,
  type TemplateType,
} from "@/shared/enums/template.enums";
```

2. 在 `const store = useTemplateStore();` 之后替换原第 54 行的加载语句为：

```ts
// 当前管理的模板类型（slash / page），切换时按需懒加载
const activeType = ref<TemplateType>(TEMPLATE_TYPE.SLASH);

if (!store.isLoaded(activeType.value)) store.fetch(activeType.value);
watch(activeType, (type) => {
  if (!store.isLoaded(type)) store.fetch(type);
});
```

3. Task 3 中固定的 `TEMPLATE_TYPE.SLASH` 全部改为 `activeType.value`：

```ts
const allTemplates = computed<TemplateItem[]>(() =>
  store.allTemplates(activeType.value, locale.value),
);
```

```ts
async function onSave(tpl: CustomTemplate) {
  const ok = await store.saveCustom(activeType.value, tpl);
  if (ok) message.success(t("SETTINGS.TEMPLATE_SETTINGS.SAVED"));
  else message.error(t("ERROR.TEMPLATE.SAVE_FAILED"));
}
```

```ts
async function onDelete(row: TemplateItem) {
  // 仅「自定义」职业的模板有删除入口，直接移除当前类型下的自定义模板
  const ok = await store.removeCustom(activeType.value, row.id);
  if (ok) message.success(t("SETTINGS.TEMPLATE_SETTINGS.DELETED"));
  else message.error(t("ERROR.TEMPLATE.DELETE_FAILED"));
}
```

```ts
async function onToggle(row: TemplateItem, enabled: boolean) {
  const ok = await store.setEnabled(
    activeType.value,
    row.id,
    row.builtIn,
    enabled,
  );
  if (!ok) message.error(t("ERROR.TEMPLATE.SAVE_FAILED"));
}
```

表格列定义、职业过滤、`openCreate`/`openEdit` 不变（`TemplateEditModal` 与 `editingTemplate` 均类型无关，保存由 `onSave` 携带 `activeType` 路由）。

- [ ] **Step 3: 验证**

```bash
pnpm typecheck
pnpm test
```

Expected: 均通过。

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/settings/template/TemplateSettings.vue
git commit -m "feat(settings): manage templates by type with tabs"
```

---

### Task 6: 新建页面弹窗组件

**Files:**
- Create: `src/renderer/components/project/PageCreateModal.vue`

仿照 `ProjectEditModal.vue` 的 Naive UI modal + form 模式；模板列表为可选中卡片（首项「不使用模板」），选中模板且用户未手改标题时自动填充模板标题。

- [ ] **Step 1: 创建 `src/renderer/components/project/PageCreateModal.vue`**

完整内容：

```vue
<template>
  <n-modal :show="show" preset="card" :title="t('TIPS.PAGE.CREATE_TITLE')" style="width: 520px"
    :mask-closable="false" @update:show="handleUpdateShow">
    <n-form ref="formRef" :model="formData" :rules="formRules" label-placement="top">
      <n-form-item :label="t('TIPS.PAGE.PAGE_TITLE')" path="title">
        <n-input v-model:value="formData.title" :placeholder="t('TIPS.PAGE.INPUT_PAGE_TITLE')"
          @input="titleTouched = true" />
      </n-form-item>
      <n-form-item :label="t('TIPS.PAGE.SELECT_TEMPLATE')">
        <div class="template-list">
          <button type="button" class="template-item"
            :class="{ 'is-selected': selectedTemplateId === '' }" @click="selectTemplate('')">
            <div class="template-item-icon">
              <n-icon size="18">
                <Add />
              </n-icon>
            </div>
            <div class="template-item-info">
              <div class="template-item-title">{{ t("TIPS.PAGE.NO_TEMPLATE") }}</div>
              <div class="template-item-desc">{{ t("TIPS.PAGE.NO_TEMPLATE_DESC") }}</div>
            </div>
          </button>
          <button v-for="tpl in templateOptions" :key="tpl.id" type="button" class="template-item"
            :class="{ 'is-selected': selectedTemplateId === tpl.id }" @click="selectTemplate(tpl.id)">
            <div class="template-item-icon">
              <component :is="resolveTemplateIcon(tpl.icon)" class="template-item-svg" />
            </div>
            <div class="template-item-info">
              <div class="template-item-title">{{ tpl.title }}</div>
              <div class="template-item-desc">{{ tpl.description }}</div>
            </div>
          </button>
        </div>
      </n-form-item>
    </n-form>
    <template #footer>
      <n-flex justify="flex-end" :gap="12">
        <n-button @click="handleUpdateShow(false)">{{ t("ACTION.COMMON.CANCEL") }}</n-button>
        <n-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ t("ACTION.COMMON.CREATE") }}
        </n-button>
      </n-flex>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useMessage } from "naive-ui";
import type { FormInst, FormRules } from "naive-ui";
import { Add } from "@vicons/ionicons5";
import { PAGE_TYPE } from "@/shared/enums";
import { TEMPLATE_TYPE } from "@/shared/enums/template.enums";
import { useConfig } from "@/renderer/composables/useConfig";
import { usePage } from "@/renderer/composables/usePage";
import { useTemplateStore } from "@/renderer/store/template.store";
import { resolveTemplateIcon } from "@/renderer/components/editor/slash/commands/template-icons";

const props = defineProps<{
  show: boolean;
  projectId: string;
  /** 新页面的父页面；null 表示根级页面 */
  parentId: string | null;
}>();

const emit = defineEmits<{
  (e: "update:show", show: boolean): void;
  (e: "created", pageId: string): void;
}>();

const { t } = useI18n();
const message = useMessage();
const { locale } = useConfig();
const { createPage } = usePage();
const templateStore = useTemplateStore();

const submitting = ref(false);
const formRef = ref<FormInst | null>(null);
const formData = ref({ title: "" });
/** 用户是否手动修改过标题（未修改时选模板可自动填充模板标题） */
const titleTouched = ref(false);
const selectedTemplateId = ref("");

const formRules: FormRules = {
  title: [
    { required: true, message: t("TIPS.PAGE.INPUT_PAGE_TITLE"), trigger: "blur" },
  ],
};

// 打开弹窗时：确保页面模板已加载并重置表单
watch(
  () => props.show,
  (visible) => {
    if (!visible) return;
    if (!templateStore.isLoaded(TEMPLATE_TYPE.PAGE)) {
      templateStore.fetch(TEMPLATE_TYPE.PAGE);
    }
    formData.value.title = "";
    titleTouched.value = false;
    selectedTemplateId.value = "";
  },
);

/** 可选的页面模板（仅启用的；不区分职业，文档模板对所有职业通用） */
const templateOptions = computed(() =>
  templateStore
    .allTemplates(TEMPLATE_TYPE.PAGE, locale.value)
    .filter((tpl) => tpl.enabled),
);

function selectTemplate(id: string) {
  selectedTemplateId.value = id;
  // 用户未手动输入标题时，选中模板自动填充模板标题
  if (!titleTouched.value) {
    const tpl = templateOptions.value.find((item) => item.id === id);
    formData.value.title = tpl?.title ?? "";
  }
}

const handleUpdateShow = (value: boolean) => emit("update:show", value);

async function handleSubmit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  const tpl = templateOptions.value.find(
    (item) => item.id === selectedTemplateId.value,
  );
  submitting.value = true;
  try {
    const id = await createPage({
      projectId: props.projectId,
      parentId: props.parentId,
      pageType: PAGE_TYPE.PROJECT_CHAPTER,
      title: formData.value.title.trim(),
      // 选中模板时以模板 Markdown 作为初始内容；否则创建空白页面
      content: tpl?.markdown ?? "",
    });
    if (id) {
      message.success(t("NOTIFICATION.SUCCESS"));
      emit("update:show", false);
      emit("created", id);
    } else {
      message.error(t("ERROR.PAGE.CREATE_FAILED"));
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped lang="scss">
.template-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-height: 240px;
  overflow-y: auto;
}

.template-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  text-align: left;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--primary-color);
  }

  &.is-selected {
    border-color: var(--primary-color);
    background: color-mix(in srgb, var(--primary-color) 10%, transparent);
  }
}

.template-item-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.template-item-svg {
  width: 18px;
  height: 18px;
}

.template-item-info {
  flex: 1;
  min-width: 0;
}

.template-item-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color);
  line-height: 1.4;
}

.template-item-desc {
  font-size: 12px;
  color: var(--text-color-3);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
```

说明：导入路径已核实——`src/shared/enums/index.ts` 未 re-export `template.enums`，故 `TEMPLATE_TYPE` 必须从 `@/shared/enums/template.enums` 单独导入（`PAGE_TYPE` 走 `@/shared/enums`，与项目现有用法一致）。

- [ ] **Step 2: 验证 typecheck**

```bash
pnpm typecheck
```

Expected: 0 错误（组件尚未被引用，但须通过类型检查）。

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/project/PageCreateModal.vue
git commit -m "feat(page): add page create modal with template picker"
```

---

### Task 7: 文件树接入新建页面弹窗

**Files:**
- Modify: `src/renderer/components/project/FileTree.vue`

- [ ] **Step 1: script 区改造**

1. import 区：删除 `import { PAGE_TYPE } from "@/shared/enums";`（不再使用），`usePage` 解构去掉 `createPage`，新增弹窗导入：

```ts
import { usePage } from "@/renderer/composables/usePage";
import FileTreeNode from "./FileTreeNode.vue";
import PageOperationModal from "./PageOperationModal.vue";
import PageCreateModal from "./PageCreateModal.vue";
```

```ts
const { deletePage, movePage } = usePage();
```

2. 用弹窗状态 + 创建回调替换原 `createPageNode`（原直接 `createPage` 的 31-44 行）：

```ts
// 新建页面弹窗状态
const createVisible = ref(false);
const createParentId = ref<string | null>(null);

function createPageNode(parentId: string | null) {
  createParentId.value = parentId;
  createVisible.value = true;
}

function handleCreated(pageId: string) {
  createVisible.value = false;
  emit("changed");
  // 新建页面后自动进入新页面编辑
  emit("select", pageId);
}
```

（`handleMore` / `handleMoved` / `handleDeleted` 不变。注意：`noUnusedLocals` 严格模式，确认 `PAGE_TYPE`、`createPage` 无残留引用。）

- [ ] **Step 2: template 区在 `PageOperationModal` 之后追加弹窗**

```vue
    <PageCreateModal :show="createVisible" :project-id="projectId" :parent-id="createParentId"
      @update:show="createVisible = $event" @created="handleCreated" />
```

- [ ] **Step 3: 验证**

```bash
pnpm typecheck
pnpm test
```

Expected: 均通过。

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/project/FileTree.vue
git commit -m "feat(project): create pages via modal from file tree"
```

---

### Task 8: 全量验证

**Files:** 无新增改动（发现问题则修复并补充提交）

- [ ] **Step 1: 静态检查**

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Expected: 三项全部通过（测试含新增 `builtin-page-templates.test.ts` 4 例、更新后的 `template.api.test.ts` 7 例）。

- [ ] **Step 2: 手动验证（`pnpm dev`）**

按清单逐项确认：

1. **新建页面（不选模板）**：打开作品 → 文件树头部「+」→ 弹窗出现 → 保持「不使用模板」→ 输入标题 → 创建 → 新页面为空白内容并自动选中。
2. **新建页面（选模板）**：弹窗选「产品需求说明书」→ 标题自动填充 → 创建 → 编辑器打开且内容为 PRD 骨架（Markdown 正常渲染）。
3. **子页面创建**：文件树节点「新建子页面」入口 → 同样打开弹窗，创建后挂到对应父节点下。
4. **Slash 菜单回归**：编辑器行首输入 `/` → 模板组仅显示 slash 模板（含按职业过滤），插入行为不变。
5. **设置页 - 类型切换**：设置 → 模板 → 「Slash 模板」/「页面模板」Tab 切换 → 列表各自正确（页面模板显示 5 个内置文档模板）。
6. **设置页 - 自定义页面模板**：在「页面模板」页新建自定义模板 → 列表出现且可编辑/删除 → 新建页面弹窗中出现该模板 → 禁用后弹窗不再显示。
7. **存储落盘**：工作区目录出现 `templates/page/templates.json`，内容含 `customTemplates` / `disabledTemplateIds`；`templates/slash/templates.json` 旧数据不变。
8. **标题手动输入保护**：先手动改标题再切换模板 → 标题不被覆盖。

- [ ] **Step 3: 修复发现的问题（如有）并提交**

```bash
git add -A
git commit -m "fix(template): address issues found in verification"
```

- [ ] **Step 4: 推送并发起 PR**

```bash
git push -u origin feature/template-types
```

在 GitHub 上向 `dev` 发起 Pull Request（dev 受保护，禁止直接 push）。

---

## Self-Review 结论

- **Spec 覆盖**：模板类型扩展（Task 1/3）、page 模板定位为文档模板 + 内置常用 + 自定义（Task 2/5）、slash 模板用于斜杠命令（Task 3 Step 8 回归）、page 模板用于创建页面（Task 6/7）、新建页面弹窗支持选/不选模板（Task 6）——全部有对应任务。
- **占位符扫描**：所有代码步骤均给出完整代码/精确替换指令，无 TBD/TODO。
- **类型一致性**：`TemplateFile` / `TemplateItem` / `TemplateType` / `TEMPLATE_TYPE` / `isLoaded` / `allTemplates(type, locale)` 等命名在 Task 1/3/5/6/7 间已交叉核对一致；`mergeTemplates` 签名不变（类型重命名除外）。
- **绿色检查点**：每个任务结束时 typecheck + test 均可通过（Task 1 原子化重命名；Task 3 同步修补 SlashMenu/TemplateSettings 调用方；Task 3 必须同步更新 `template.api.test.ts` 的 mock 方法名，否则 service mock 失配导致测试失败）。
