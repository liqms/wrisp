# Slash 模板自定义功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户能在「本地工作区」保存 Slash 模板。内置模板支持**中文/英文**双语；设置页可**按职业快速筛选**；用户可**启用/禁用**任意模板（内置 + 自定义），并可**新增/编辑/删除**自定义模板。

**Architecture:**

- **模板数据来源分两类**：
  - **内置模板**：renderer 端静态数据（`templates.ts`），声明式定义，标题/描述/正文均用 `LocalizedText = { zh; en }` 双语字面量，不再走 i18n 键。
  - **自定义模板**：存于本地工作区 JSON 文件 `<workspace>/templates/slash/templates.json`（结构见下），由主进程 `template.service.ts` 读写，通过 IPC 暴露给渲染端。
- **启用状态**：内置模板用「禁用黑名单」`disabledTemplateIds: string[]`（默认全部启用）；自定义模板用自身 `enabled: boolean` 字段。
- **合并视图**：纯函数 `mergeTemplates(builtinTemplates, file, locale): SlashTemplateItem[]` 把内置（按当前语言解析）+ 自定义合并为统一可渲染项（`builtIn` 标记来源）。设置页与 Slash 菜单**共用**同一个 Pinia store（`template.store.ts`）。
- **职业过滤**：Slash 菜单按「当前用户职业 + 通用职业(GENERAL) + enabled」过滤展示；设置页提供「按职业筛选」下拉（含"全部职业"与"通用"）。
- **IPC 遵循 4 层模式**：`preload/modules/template.ts` → `preload/types/template.ts` → `core/apis/template.api.ts` → `ipcMain/template.ipc.ts`。

**Tech Stack:** Vue 3 `<script setup>`、Pinia（composition API）、Tiptap、`marked`（同步 markdown→HTML）、Naive UI、TypeScript strict、Vitest（happy-dom）。

**关键前置约定（复用现有能力）：**

- **IPC 4 层模式**：参考 `.github/instructions/ipc-channel.instructions.md`；新通道 `template:getFile` / `template:upsertCustom` / `template:deleteCustom` / `template:setEnabled`。
- **主进程服务单例**：`config.service.ts` 是 `configService` 单例导出；`template.service.ts` 同样导出单例 `templateService`。
- **workspace 路径解析**：优先 `globalThis.__WRISP_WORKSPACE_PATH__`，否则 `configService.getValue("workspace")`（与现有服务一致）。
- **编辑器插入 HTML**：复用 `helpers.ts` 中 `insertMarkdownTemplate(editor, pos, markdown)`（先 `deleteSlashText` 再 `marked.parse` 插入）。
- **配置保存**：职业设置沿用 config store 的 `setValue("userInfo.preferences.profession", v)`，无需新增 IPC。
- **i18n**：键必须 `zhCN.ts`/`enUS.ts` 成对添加，否则 `tests/unit/shared/locale-keys.test.ts` 失败；删除旧 `EDITOR.SLASH.PM_TEMPLATE.*` 键时两文件同步删。
- **TS strict**：新增文件满足 `noUnusedLocals` / `noUnusedParameters`。
- **locale 取值**：`LOCALE.ZH = "zhCN"` / `LOCALE.EN = "enUS"`；`LocalizedText` 按 `locale === LOCALE.EN` 选 `en`，否则选 `zh`。

---

## 文件结构

```
src/shared/
├── enums/
│   └── profession.enums.ts                  # 职业枚举扩展（MODIFY）
├── types/
│   ├── template.types.ts                    # 模板共享类型（CREATE）
│   └── index.ts                             # 注册 template.types（MODIFY）

src/main/
├── constants/
│   └── folder.constants.ts                  # 新增 templates 目录常量（MODIFY）
├── core/services/
│   └── template.service.ts                  # 工作区 JSON 读写服务（CREATE）
├── core/apis/
│   └── template.api.ts                      # API 层（CREATE）
├── ipcMain/
│   ├── template.ipc.ts                      # IPC handler（CREATE）
│   └── index.ts                             # 导出 registerTemplateHandlers（MODIFY）
├── preload/
│   ├── types/
│   │   ├── template.ts                      # TemplateAPI 类型（CREATE）
│   │   └── index.ts                         # 聚合 TemplateAPI（MODIFY）
│   └── modules/
│       ├── template.ts                      # preload 模块（CREATE）
│       └── index.ts                         # 注册 templateModule（MODIFY）
└── index.ts                                 # 调用 registerTemplateHandlers()（MODIFY）

src/renderer/
├── types/electron.d.ts                      # ElectronAPI 增加 template（MODIFY）
├── store/template.store.ts                  # 模板 Pinia store（CREATE）
├── components/editor/slash/commands/
│   ├── templates.ts                         # 内置模板双语重写 + buildTemplateGroup 重构（MODIFY）
│   ├── template-merge.ts                    # mergeTemplates 纯函数（CREATE）
│   └── registry.ts                          # getCommandGroups 签名调整（MODIFY）
├── components/editor/slash/SlashMenu.vue    # 接入 template store（MODIFY）
├── components/settings/
│   ├── TemplateSettings.vue                 # 设置页：筛选 + 列表 + 开关 + 增删改（CREATE）
│   └── TemplateEditModal.vue                # 新增/编辑弹窗（CREATE）
└── components/SettingsView.vue              # 注册新菜单项（MODIFY）

src/shared/i18n/locales/zhCN.ts / enUS.ts    # 职业/模板设置键 + ERROR.TEMPLATE + 清理旧键（MODIFY）
src/shared/enums/errorCode.enums.ts          # 新增 TEMPLATE 错误码与分类（MODIFY）

tests/unit/
├── renderer/slash-templates.test.ts         # 适配新签名（MODIFY）
├── renderer/template-merge.test.ts          # mergeTemplates 纯逻辑测试（CREATE）
└── main/template.api.test.ts                # template.api 单测（CREATE）
```

---

## Task 1: 扩展职业枚举 + 设置默认

**Files:**

- Modify: `src/shared/enums/profession.enums.ts`
- Modify: `src/shared/i18n/locales/zhCN.ts`、`enUS.ts`（`SETTINGS.PROFESSION.OPTION_*`）
- Modify: `src/renderer/components/settings/GeneralSettings.vue`（职业下拉选项）

- [ ] **Step 1: 扩展职业枚举**

```ts
export const PROFESSION = {
  /** 通用职业标签：标记为 general 的模板对所有职业可用 */
  GENERAL: "general",
  PM: "pm",
  STUDENT: "student",
  WRITER: "writer",
  RESEARCHER: "researcher",
  DEVELOPER: "developer",
} as const;

export type Profession = (typeof PROFESSION)[keyof typeof PROFESSION];
```

- [ ] **Step 2: i18n 新增职业选项（zhCN 与 enUS 成对）**

zhCN `SETTINGS.PROFESSION`：

```ts
PROFESSION: {
  LABEL: "职业",
  DESC: "决定 Slash 菜单展示的模板",
  OPTION_GENERAL: "通用",
  OPTION_PM: "产品经理",
  OPTION_STUDENT: "学生",
  OPTION_WRITER: "作家",
  OPTION_RESEARCHER: "研究员",
  OPTION_DEVELOPER: "开发者",
  SAVED: "职业已保存",
},
```

enUS `SETTINGS.PROFESSION`：

```ts
PROFESSION: {
  LABEL: "Profession",
  DESC: "Determines which templates show in the Slash menu",
  OPTION_GENERAL: "General",
  OPTION_PM: "Product Manager",
  OPTION_STUDENT: "Student",
  OPTION_WRITER: "Writer",
  OPTION_RESEARCHER: "Researcher",
  OPTION_DEVELOPER: "Developer",
  SAVED: "Profession saved",
},
```

- [ ] **Step 3: GeneralSettings.vue 职业下拉扩展**

`professionOptions` 改为完整遍历（`PROFESSION` 已是 `as const` 对象，可直接 `Object.values`），并**排除通用标签** `GENERAL`（通用不是用户的职业）：

```ts
const professionOptions = (Object.values(PROFESSION) as Profession[])
  .filter((value) => value !== PROFESSION.GENERAL)
  .map((value) => ({
    label: t(`SETTINGS.PROFESSION.OPTION_${value.toUpperCase()}`),
    value,
  }));
```

（`t` 需从 `useI18n()` 解构；`PROFESSION` 已 import。）

---

## Task 2: 共享类型 + 模板错误码

**Files:**

- Create: `src/shared/types/template.types.ts`
- Modify: `src/shared/types/index.ts`
- Modify: `src/shared/enums/errorCode.enums.ts`
- Modify: `src/shared/i18n/locales/zhCN.ts`、`enUS.ts`（`ERROR.TEMPLATE.*`）

- [ ] **Step 1: 编写共享类型**

```ts
// src/shared/types/template.types.ts
import type { Profession } from "@/shared/enums/profession.enums";

/** 双语文本：zh 为简体中文，en 为英文 */
export interface LocalizedText {
  zh: string;
  en: string;
}

/** 自定义模板（用户创建，存于工作区 JSON） */
export interface CustomTemplate {
  id: string;
  title: string;
  description: string;
  /** 图标 HTML（emoji 或内联 HTML） */
  icon: string;
  /** Markdown 模板正文 */
  markdown: string;
  profession: Profession;
  enabled: boolean;
}

/** 工作区 slash 模板文件内容（templates.json 的顶层结构） */
export interface SlashTemplateFile {
  /** 自定义模板列表 */
  customTemplates: CustomTemplate[];
  /** 被用户禁用的内置模板 id 黑名单 */
  disabledTemplateIds: string[];
}

/** 合并后的模板项（内置已按当前语言解析；设置页与 Slash 菜单共用） */
export interface SlashTemplateItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  markdown: string;
  profession: Profession;
  /** true=内置模板，false=自定义模板 */
  builtIn: boolean;
  enabled: boolean;
}
```

- [ ] **Step 2: 注册导出**

`src/shared/types/index.ts` 追加：`export * from "./template.types";`

- [ ] **Step 3: 新增模板错误码**

`errorCode.enums.ts` 的枚举新增（放在 `TAG_*` 之后即可）：

```ts
// ============ 模板错误 ============
TEMPLATE_GET_FAILED = "ERROR.TEMPLATE.GET_FAILED",
TEMPLATE_SAVE_FAILED = "ERROR.TEMPLATE.SAVE_FAILED",
TEMPLATE_DELETE_FAILED = "ERROR.TEMPLATE.DELETE_FAILED",
```

`ErrorCategory` union、`getErrorCategory()` switch、`getErrorCategoryMap()` 的 `categoryMap` 均增加 `"TEMPLATE"` 分支（`case "TEMPLATE": return "TEMPLATE";`）。

- [ ] **Step 4: i18n 新增 `ERROR.TEMPLATE`（两语言成对）**

zhCN：

```ts
ERROR: {
  // ... 已有键
  TEMPLATE: {
    GET_FAILED: "获取模板失败",
    SAVE_FAILED: "保存模板失败",
    DELETE_FAILED: "删除模板失败",
  },
}
```

enUS：

```ts
ERROR: {
  // ... 已有键
  TEMPLATE: {
    GET_FAILED: "Failed to get templates",
    SAVE_FAILED: "Failed to save template",
    DELETE_FAILED: "Failed to delete template",
  },
}
```

---

## Task 3: 主进程模板服务 + 文件夹常量

**Files:**

- Modify: `src/main/constants/folder.constants.ts`
- Create: `src/main/core/services/template.service.ts`

- [ ] **Step 1: 文件夹常量**

`folder.constants.ts` 追加：

```ts
/** 模板根文件夹（工作空间下） */
export const TEMPLATES_DIR = "templates" as const;

/** Slash 模板子文件夹 */
export const SLASH_TEMPLATES_DIR = "slash" as const;

/** Slash 模板文件名 */
export const SLASH_TEMPLATES_FILE = "templates.json" as const;
```

- [ ] **Step 2: 模板服务**

```ts
// src/main/core/services/template.service.ts
import fs from "fs";
import path from "path";
import { configService } from "@/main/core/services/config.service";
import {
  TEMPLATES_DIR,
  SLASH_TEMPLATES_DIR,
  SLASH_TEMPLATES_FILE,
} from "@/main/constants/folder.constants";
import type {
  CustomTemplate,
  SlashTemplateFile,
} from "@/shared/types/template.types";
import { Logger } from "@/main/utils/logger";

const DEFAULT_FILE: SlashTemplateFile = {
  customTemplates: [],
  disabledTemplateIds: [],
};

class TemplateService {
  private static instance: TemplateService | null = null;

  private constructor() {}

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

  private getFilePath(): string {
    return path.join(
      this.getWorkspacePath(),
      TEMPLATES_DIR,
      SLASH_TEMPLATES_DIR,
      SLASH_TEMPLATES_FILE,
    );
  }

  /** 读取 slash 模板文件；文件缺失或损坏时返回默认值 */
  public getSlashTemplatesFile(): SlashTemplateFile {
    const filePath = this.getFilePath();
    try {
      if (!fs.existsSync(filePath)) return { ...DEFAULT_FILE };
      const raw = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw) as SlashTemplateFile;
      return {
        customTemplates: Array.isArray(data.customTemplates)
          ? data.customTemplates
          : [],
        disabledTemplateIds: Array.isArray(data.disabledTemplateIds)
          ? data.disabledTemplateIds
          : [],
      };
    } catch (error) {
      Logger.error("读取 slash 模板文件失败", {
        error: String(error),
        filePath,
      });
      return { ...DEFAULT_FILE };
    }
  }

  /** 原子写入 slash 模板文件 */
  public saveSlashTemplatesFile(file: SlashTemplateFile): void {
    const filePath = this.getFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(file, null, 2), "utf-8");
  }

  /** 新增或按 id 更新自定义模板，返回最新文件 */
  public upsertCustomTemplate(tpl: CustomTemplate): SlashTemplateFile {
    const file = this.getSlashTemplatesFile();
    const idx = file.customTemplates.findIndex((c) => c.id === tpl.id);
    if (idx >= 0) file.customTemplates[idx] = tpl;
    else file.customTemplates.push(tpl);
    this.saveSlashTemplatesFile(file);
    return file;
  }

  /** 按 id 删除自定义模板，返回最新文件 */
  public deleteCustomTemplate(id: string): SlashTemplateFile {
    const file = this.getSlashTemplatesFile();
    file.customTemplates = file.customTemplates.filter((c) => c.id !== id);
    this.saveSlashTemplatesFile(file);
    return file;
  }

  /** 设置模板启用状态：内置走黑名单；自定义写 enabled 字段，返回最新文件 */
  public setTemplateEnabled(
    id: string,
    builtIn: boolean,
    enabled: boolean,
  ): SlashTemplateFile {
    const file = this.getSlashTemplatesFile();
    if (builtIn) {
      const disabled = new Set(file.disabledTemplateIds);
      if (enabled) disabled.delete(id);
      else disabled.add(id);
      file.disabledTemplateIds = [...disabled];
    } else {
      const target = file.customTemplates.find((c) => c.id === id);
      if (target) target.enabled = enabled;
    }
    this.saveSlashTemplatesFile(file);
    return file;
  }
}

export const templateService = TemplateService.getInstance();
```

---

## Task 4: template IPC（4 层）

**Files:**

- Create: `src/main/core/apis/template.api.ts`
- Create: `src/main/ipcMain/template.ipc.ts`
- Modify: `src/main/ipcMain/index.ts`
- Create: `src/main/preload/types/template.ts`
- Modify: `src/main/preload/types/index.ts`
- Create: `src/main/preload/modules/template.ts`
- Modify: `src/main/preload/modules/index.ts`
- Modify: `src/main/index.ts`
- Modify: `src/renderer/types/electron.d.ts`

- [ ] **Step 1: API 层**

```ts
// src/main/core/apis/template.api.ts
import { templateService } from "@/main/core/services/template.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type {
  ApiResponse,
  CustomTemplate,
  SlashTemplateFile,
} from "@/shared/types";
import { Logger } from "@/main/utils/logger";

async function getFile(): Promise<ApiResponse<SlashTemplateFile>> {
  try {
    return response.success(templateService.getSlashTemplatesFile());
  } catch (error) {
    Logger.error("获取 slash 模板失败", { error: String(error) });
    return response.error(ErrorCode.TEMPLATE_GET_FAILED, error as Error);
  }
}

async function upsertCustom(
  tpl: CustomTemplate,
): Promise<ApiResponse<SlashTemplateFile>> {
  try {
    return response.success(templateService.upsertCustomTemplate(tpl));
  } catch (error) {
    Logger.error("保存 slash 模板失败", { error: String(error) });
    return response.error(ErrorCode.TEMPLATE_SAVE_FAILED, error as Error);
  }
}

async function deleteCustom(
  id: string,
): Promise<ApiResponse<SlashTemplateFile>> {
  try {
    return response.success(templateService.deleteCustomTemplate(id));
  } catch (error) {
    Logger.error("删除 slash 模板失败", { error: String(error) });
    return response.error(ErrorCode.TEMPLATE_DELETE_FAILED, error as Error);
  }
}

async function setEnabled(
  id: string,
  builtIn: boolean,
  enabled: boolean,
): Promise<ApiResponse<SlashTemplateFile>> {
  try {
    return response.success(
      templateService.setTemplateEnabled(id, builtIn, enabled),
    );
  } catch (error) {
    Logger.error("更新模板启用状态失败", { error: String(error) });
    return response.error(ErrorCode.TEMPLATE_SAVE_FAILED, error as Error);
  }
}

export { getFile, upsertCustom, deleteCustom, setEnabled };
```

- [ ] **Step 2: IPC handler**

```ts
// src/main/ipcMain/template.ipc.ts
import { ipcMain } from "electron";
import {
  getFile,
  upsertCustom,
  deleteCustom,
  setEnabled,
} from "@/main/core/apis/template.api";
import type { CustomTemplate, SlashTemplateFile } from "@/shared/types";

export function registerTemplateHandlers() {
  ipcMain.handle("template:getFile", (): Promise<any> => getFile());
  ipcMain.handle(
    "template:upsertCustom",
    (_, tpl: CustomTemplate): Promise<any> => upsertCustom(tpl),
  );
  ipcMain.handle(
    "template:deleteCustom",
    (_, id: string): Promise<any> => deleteCustom(id),
  );
  ipcMain.handle(
    "template:setEnabled",
    (_, id: string, builtIn: boolean, enabled: boolean): Promise<any> =>
      setEnabled(id, builtIn, enabled),
  );
}
```

`ipcMain/index.ts` 追加导出：`export { registerTemplateHandlers } from './template.ipc'`。

- [ ] **Step 3: preload type**

```ts
// src/main/preload/types/template.ts
import type { ApiResponse } from "@/shared/types";
import type {
  CustomTemplate,
  SlashTemplateFile,
} from "@/shared/types/template.types";

export interface TemplateAPI {
  getFile: () => Promise<ApiResponse<SlashTemplateFile>>;
  upsertCustom: (
    tpl: CustomTemplate,
  ) => Promise<ApiResponse<SlashTemplateFile>>;
  deleteCustom: (id: string) => Promise<ApiResponse<SlashTemplateFile>>;
  setEnabled: (
    id: string,
    builtIn: boolean,
    enabled: boolean,
  ) => Promise<ApiResponse<SlashTemplateFile>>;
}
```

`preload/types/index.ts`：import `TemplateAPI`，`ElectronAPI` 增加 `template: TemplateAPI;`，并在文件底部 `export type { ... TemplateAPI }`。

- [ ] **Step 4: preload module**

```ts
// src/main/preload/modules/template.ts
import { ipcRenderer } from "electron";
import type { TemplateAPI } from "../types/template";

export const templateModule: TemplateAPI = {
  getFile: () => ipcRenderer.invoke("template:getFile"),
  upsertCustom: (tpl) => ipcRenderer.invoke("template:upsertCustom", tpl),
  deleteCustom: (id) => ipcRenderer.invoke("template:deleteCustom", id),
  setEnabled: (id, builtIn, enabled) =>
    ipcRenderer.invoke("template:setEnabled", id, builtIn, enabled),
};
```

`preload/modules/index.ts`：import `templateModule`，`modules` 增加 `template: templateModule`。

- [ ] **Step 5: 主进程注册**

`src/main/index.ts`：import `registerTemplateHandlers`，在 `registerTaskHandlers()` 附近调用 `registerTemplateHandlers();`。

- [ ] **Step 6: 渲染端类型声明**

`src/renderer/types/electron.d.ts`：import `TemplateAPI`（`@/main/preload/types/template`），`ElectronAPI` 增加：

```ts
// Slash 模板
template: TemplateAPI;
```

---

## Task 5: 内置模板双语重写 + 合并纯函数 + registry 重构

**Files:**

- Modify: `src/renderer/components/editor/slash/commands/templates.ts`（重写）
- Create: `src/renderer/components/editor/slash/commands/template-merge.ts`
- Modify: `src/renderer/components/editor/slash/commands/registry.ts`

- [ ] **Step 1: 重写 templates.ts（双语数据 + buildTemplateGroup）**

要点：`Template` → `BuiltInTemplateDef`；`title/description/markdown` 改为 `LocalizedText`；新增 5 个职业标签的模板（general/student/writer/researcher/developer）；`buildTemplateGroup(t, items)` 只做「条目 → 命令」映射（职业/启用过滤已由调用方完成）。

```ts
import type { CommandGroup, SlashCommand } from "./types";
import type { Profession } from "@/shared/enums/profession.enums";
import type {
  LocalizedText,
  SlashTemplateItem,
} from "@/shared/types/template.types";
import { insertMarkdownTemplate } from "./helpers";

/** 内置模板的纯数据定义（双语） */
export interface BuiltInTemplateDef {
  id: string;
  profession: Profession;
  title: LocalizedText;
  description: LocalizedText;
  icon: string;
  markdown: LocalizedText;
}

/**
 * 内置模板清单。
 * 标题/描述/正文均以 { zh, en } 双语字面量声明，不再依赖 i18n 键；
 * 仅保留碎片化的输入型模板（待办/回顾/头脑风暴/需求/访谈/竞品/数据/纪要/计划/方案/……）；
 * profession 为 PROFESSION.GENERAL 的模板对所有职业可见。
 */
export const builtinTemplates: BuiltInTemplateDef[] = [
  {
    id: "todo",
    profession: "general",
    title: { zh: "待办清单", en: "Todo List" },
    description: {
      zh: "插入待办清单",
      en: "Insert a todo list",
    },
    icon: '<span style="font-size:14px">✅</span>',
    markdown: {
      zh: `## 待办清单 - {标题}
- [ ] {任务1}
- [ ] {任务2}
- 优先级：P0/P1/P2
`,
      en: `## Todo List - {title}
- [ ] {task 1}
- [ ] {task 2}
- Priority: P0/P1/P2
`,
    },
  },
  {
    id: "daily-review",
    profession: "general",
    title: { zh: "每日回顾", en: "Daily Review" },
    description: {
      zh: "插入每日回顾框架",
      en: "Insert daily review skeleton",
    },
    icon: '<span style="font-size:14px">🌅</span>',
    markdown: {
      zh: `## 每日回顾 - {日期}
- 今日完成：
- 遇到的问题：
- 明日计划：
`,
      en: `## Daily Review - {date}
- Done today:
- Blockers:
- Plan for tomorrow:
`,
    },
  },
  {
    id: "brainstorm",
    profession: "general",
    title: { zh: "头脑风暴", en: "Brainstorm" },
    description: {
      zh: "插入头脑风暴框架",
      en: "Insert brainstorm skeleton",
    },
    icon: '<span style="font-size:14px">💭</span>',
    markdown: {
      zh: `## 头脑风暴 - {主题}
- 想法：
- 评估：
- 下一步：
`,
      en: `## Brainstorm - {topic}
- Ideas:
- Assessment:
- Next steps:
`,
    },
  },
  {
    id: "requirement",
    profession: "pm",
    title: { zh: "用户需求", en: "User Requirement" },
    description: {
      zh: "插入用户需求框架",
      en: "Insert user requirement skeleton",
    },
    icon: '<span style="font-size:14px">📌</span>',
    markdown: {
      zh: `- 需求：
- 用户故事：作为一名{角色}，我希望{功能}，以便{价值}
- 优先级：P0/P1/P2
`,
      en: `- Requirement:
- User story: As a {role}, I want {feature}, so that {value}
- Priority: P0/P1/P2
`,
    },
  },
  {
    id: "interview",
    profession: "pm",
    title: { zh: "用户访谈", en: "User Interview" },
    description: {
      zh: "插入用户访谈框架",
      en: "Insert user interview skeleton",
    },
    icon: '<span style="font-size:14px">💬</span>',
    markdown: {
      zh: `## 用户访谈 - {对象}
- 背景：
- 原话：
- 痛点：
`,
      en: `## User Interview - {subject}
- Background:
- Quotes:
- Pain points:
`,
    },
  },
  {
    id: "competitor",
    profession: "pm",
    title: { zh: "竞品观察", en: "Competitor Observation" },
    description: {
      zh: "插入竞品观察框架",
      en: "Insert competitor observation skeleton",
    },
    icon: '<span style="font-size:14px">🔍</span>',
    markdown: {
      zh: `## 竞品观察 - {竞品名}
- 动态：
- 影响：
`,
      en: `## Competitor Observation - {product}
- Update:
- Impact:
`,
    },
  },
  {
    id: "data",
    profession: "pm",
    title: { zh: "产品数据", en: "Product Data" },
    description: { zh: "插入产品数据框架", en: "Insert product data skeleton" },
    icon: '<span style="font-size:14px">📈</span>',
    markdown: {
      zh: `- 指标：{} 数值：{} 同比：
- 假设：
- 验证：
`,
      en: `- Metric: {} Value: {} YoY:
- Hypothesis:
- Validation:
`,
    },
  },
  {
    id: "meeting",
    profession: "pm",
    title: { zh: "会议纪要", en: "Meeting Notes" },
    description: {
      zh: "插入会议纪要框架",
      en: "Insert meeting notes skeleton",
    },
    icon: '<span style="font-size:14px">📝</span>',
    markdown: {
      zh: `## 会议纪要 - {标题}
- 时间：
- 参会：
- 决策：
- 行动项：
`,
      en: `## Meeting Notes - {title}
- Time:
- Attendees:
- Decisions:
- Action items:
`,
    },
  },
  {
    id: "plan",
    profession: "pm",
    title: { zh: "工作计划", en: "Work Plan" },
    description: { zh: "插入工作计划框架", en: "Insert work plan skeleton" },
    icon: '<span style="font-size:14px">🗓️</span>',
    markdown: {
      zh: `## 工作计划 - {主题}
- 周期：{起止时间}
- 目标：
- 任务：
  - [ ] {任务1}
  - [ ] {任务2}
- 优先级：P0/P1/P2
- 风险与依赖：
`,
      en: `## Work Plan - {topic}
- Period: {start–end}
- Goals:
- Tasks:
  - [ ] {task 1}
  - [ ] {task 2}
- Priority: P0/P1/P2
- Risks & dependencies:
`,
    },
  },
  {
    id: "tech-design",
    profession: "developer",
    title: { zh: "技术方案", en: "Technical Design" },
    description: {
      zh: "插入技术方案框架",
      en: "Insert technical design skeleton",
    },
    icon: '<span style="font-size:14px">🧩</span>',
    markdown: {
      zh: `## 技术方案 - {主题}
- 背景与目标：
- 方案对比：
- 选型理由：
- 架构图：
- 风险与回滚：
`,
      en: `## Technical Design - {topic}
- Background & goals:
- Options compared:
- Decision rationale:
- Architecture:
- Risks & rollback:
`,
    },
  },
  {
    id: "article",
    profession: "writer",
    title: { zh: "文章大纲", en: "Article Outline" },
    description: {
      zh: "插入文章大纲框架",
      en: "Insert article outline skeleton",
    },
    icon: '<span style="font-size:14px">✍️</span>',
    markdown: {
      zh: `## 文章大纲 - {主题}
- 核心观点：
- 读者对象：
- 结构：
  - 引言：
  - 正文要点：
  - 结论：
- 素材/引用：
`,
      en: `## Article Outline - {topic}
- Core thesis:
- Target readers:
- Structure:
  - Intro:
  - Key points:
  - Conclusion:
- Materials/citations:
`,
    },
  },
  {
    id: "story",
    profession: "writer",
    title: { zh: "故事梗概", en: "Story Outline" },
    description: {
      zh: "插入故事梗概框架",
      en: "Insert story outline skeleton",
    },
    icon: '<span style="font-size:14px">📖</span>',
    markdown: {
      zh: `## 故事梗概 - {标题}
- 人物：
- 设定：
- 冲突：
- 情节推进：
- 结局：
`,
      en: `## Story Outline - {title}
- Characters:
- Setting:
- Conflict:
- Plot progression:
- Ending:
`,
    },
  },
  {
    id: "idea",
    profession: "writer",
    title: { zh: "灵感记录", en: "Idea Capture" },
    description: {
      zh: "插入灵感记录框架",
      en: "Insert idea capture skeleton",
    },
    icon: '<span style="font-size:14px">💡</span>',
    markdown: {
      zh: `## 灵感记录 - {主题}
- 触发点：
- 想法：
- 可能的发展方向：
`,
      en: `## Idea Capture - {topic}
- Trigger:
- Idea:
- Possible directions:
`,
    },
  },
  {
    id: "class-notes",
    profession: "student",
    title: { zh: "课堂笔记", en: "Class Notes" },
    description: {
      zh: "插入课堂笔记框架",
      en: "Insert class notes skeleton",
    },
    icon: '<span style="font-size:14px">🎒</span>',
    markdown: {
      zh: `## 课堂笔记 - {课程}
- 日期：
- 知识点：
- 例子：
- 疑问：
`,
      en: `## Class Notes - {course}
- Date:
- Key points:
- Examples:
- Questions:
`,
    },
  },
  {
    id: "review-outline",
    profession: "student",
    title: { zh: "复习提纲", en: "Study Outline" },
    description: {
      zh: "插入复习提纲框架",
      en: "Insert study outline skeleton",
    },
    icon: '<span style="font-size:14px">📚</span>',
    markdown: {
      zh: `## 复习提纲 - {科目}
- 章节：
- 重点概念：
- 公式/定义：
- 易错点：
- 自测题：
`,
      en: `## Study Outline - {subject}
- Chapters:
- Key concepts:
- Formulas/definitions:
- Common mistakes:
- Practice questions:
`,
    },
  },
  {
    id: "reading-notes",
    profession: "student",
    title: { zh: "读书笔记", en: "Reading Notes" },
    description: {
      zh: "插入读书笔记框架",
      en: "Insert reading notes skeleton",
    },
    icon: '<span style="font-size:14px">📔</span>',
    markdown: {
      zh: `## 读书笔记 - {书名}
- 作者：
- 核心内容：
- 金句摘录：
- 我的思考：
`,
      en: `## Reading Notes - {book}
- Author:
- Core content:
- Quotes:
- My thoughts:
`,
    },
  },
  {
    id: "literature",
    profession: "researcher",
    title: { zh: "文献笔记", en: "Literature Note" },
    description: {
      zh: "插入文献阅读笔记框架",
      en: "Insert literature note skeleton",
    },
    icon: '<span style="font-size:14px">🔬</span>',
    markdown: {
      zh: `## 文献笔记 - {标题}
- 作者/年份：
- 核心观点：
- 方法：
- 结论：
- 与我的研究的关系：
`,
      en: `## Literature Note - {title}
- Author/Year:
- Core argument:
- Method:
- Findings:
- Relevance to my research:
`,
    },
  },
  {
    id: "experiment",
    profession: "researcher",
    title: { zh: "实验记录", en: "Experiment Log" },
    description: {
      zh: "插入实验记录框架",
      en: "Insert experiment log skeleton",
    },
    icon: '<span style="font-size:14px">🧪</span>',
    markdown: {
      zh: `## 实验记录 - {实验名}
- 假设：
- 方法：
- 变量：
- 结果：
- 结论：
`,
      en: `## Experiment Log - {experiment}
- Hypothesis:
- Method:
- Variables:
- Results:
- Conclusion:
`,
    },
  },
];

/** 由模板条目数组构建 Slash 命令组；空数组返回 null */
export function buildTemplateGroup(
  t: (key: string) => string,
  items: SlashTemplateItem[],
): CommandGroup | null {
  if (items.length === 0) return null;
  const commands: SlashCommand[] = items.map((tpl) => ({
    id: tpl.id,
    title: tpl.title,
    description: tpl.description,
    icon: tpl.icon,
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

- [ ] **Step 2: mergeTemplates 纯函数**

```ts
// src/renderer/components/editor/slash/commands/template-merge.ts
import { LOCALE } from "@/shared/enums";
import type {
  SlashTemplateFile,
  SlashTemplateItem,
} from "@/shared/types/template.types";
import type { BuiltInTemplateDef } from "./templates";

/**
 * 把内置模板（按当前语言解析）+ 自定义模板合并为统一列表。
 * 自定义模板排前，内置模板在后。纯函数，便于测试。
 */
export function mergeTemplates(
  builtins: BuiltInTemplateDef[],
  file: SlashTemplateFile | null,
  locale: string,
): SlashTemplateItem[] {
  const disabled = new Set(file?.disabledTemplateIds ?? []);
  const useEn = locale === LOCALE.EN;

  const builtinItems: SlashTemplateItem[] = builtins.map((def) => ({
    id: def.id,
    title: useEn ? def.title.en : def.title.zh,
    description: useEn ? def.description.en : def.description.zh,
    icon: def.icon,
    markdown: useEn ? def.markdown.en : def.markdown.zh,
    profession: def.profession,
    builtIn: true,
    enabled: !disabled.has(def.id),
  }));

  const customItems: SlashTemplateItem[] = (file?.customTemplates ?? []).map(
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

- [ ] **Step 3: registry.ts 签名调整**

```ts
// src/renderer/components/editor/slash/commands/registry.ts
import type { CommandGroup } from "./types";
import { buildDateTimeGroup } from "./dateTime.commands";
import { buildTemplateGroup } from "./templates";
import type { SlashTemplateItem } from "@/shared/types/template.types";

export type { SlashCommand, CommandGroup, SlashCommandContext } from "./types";

/**
 * 全局命令组注册表：
 * - 通用命令固定返回（日期/时间）
 * - 职业模板按「当前职业 + enabled」过滤后的条目动态追加
 */
export function getCommandGroups(
  t: (key: string) => string,
  templateItems: SlashTemplateItem[],
): CommandGroup[] {
  const groups: CommandGroup[] = [buildDateTimeGroup(t)];
  const templateGroup = buildTemplateGroup(t, templateItems);
  if (templateGroup) groups.push(templateGroup);
  return groups;
}
```

（删除不再使用的 `Profession` import 与 `getTemplatesByProfession`。）

---

## Task 6: 渲染端 template store + SlashMenu 接入

**Files:**

- Create: `src/renderer/store/template.store.ts`
- Modify: `src/renderer/components/editor/slash/SlashMenu.vue`

- [ ] **Step 1: 模板 Pinia store**

```ts
// src/renderer/store/template.store.ts
import { ref } from "vue";
import { defineStore } from "pinia";
import type {
  CustomTemplate,
  SlashTemplateFile,
  SlashTemplateItem,
} from "@/shared/types/template.types";
import { builtinTemplates } from "@/renderer/components/editor/slash/commands/templates";
import { mergeTemplates } from "@/renderer/components/editor/slash/commands/template-merge";

export const useTemplateStore = defineStore("template", () => {
  const file = ref<SlashTemplateFile | null>(null);
  const loading = ref(false);
  /** 是否已从主进程成功加载过（避免重复拉取） */
  const loaded = ref(false);

  async function fetch(): Promise<void> {
    if (loading.value) return;
    loading.value = true;
    try {
      const res = await window.electronAPI.template.getFile();
      if (res.success && res.data) {
        file.value = res.data;
        loaded.value = true;
      }
    } finally {
      loading.value = false;
    }
  }

  /** 新增或更新自定义模板，成功后同步本地 file */
  async function saveCustom(tpl: CustomTemplate): Promise<boolean> {
    const res = await window.electronAPI.template.upsertCustom(tpl);
    if (res.success && res.data) {
      file.value = res.data;
      return true;
    }
    return false;
  }

  /** 删除自定义模板 */
  async function removeCustom(id: string): Promise<boolean> {
    const res = await window.electronAPI.template.deleteCustom(id);
    if (res.success && res.data) {
      file.value = res.data;
      return true;
    }
    return false;
  }

  /** 设置启用状态（内置 builtIn=true 走黑名单；自定义 false 走 enabled 字段） */
  async function setEnabled(
    id: string,
    builtIn: boolean,
    enabled: boolean,
  ): Promise<boolean> {
    const res = await window.electronAPI.template.setEnabled(
      id,
      builtIn,
      enabled,
    );
    if (res.success && res.data) {
      file.value = res.data;
      return true;
    }
    return false;
  }

  /** 合并后的全部模板（内置按当前语言解析） */
  function allTemplates(locale: string): SlashTemplateItem[] {
    return mergeTemplates(builtinTemplates, file.value, locale);
  }

  return {
    file,
    loading,
    loaded,
    fetch,
    saveCustom,
    removeCustom,
    setEnabled,
    allTemplates,
  };
});
```

- [ ] **Step 2: SlashMenu.vue 接入 store**

script 部分修改（保持模板结构不变）：

```ts
import { useTemplateStore } from "@/renderer/store/template.store";
import { getCommandGroups, type CommandGroup } from "./commands/registry";
import { PROFESSION } from "@/shared/enums/profession.enums";

const { t } = useI18n();
const { profession, locale } = useConfig();
const templateStore = useTemplateStore();

// 打开菜单时确保模板已加载（已加载则跳过）
onMounted(() => {
  if (!templateStore.loaded) templateStore.fetch();
});

// 命令组 = 通用(日期时间) + 当前职业或通用职业且已启用的模板
const commandGroups = computed<CommandGroup[]>(() => {
  const items = templateStore
    .allTemplates(locale.value)
    .filter(
      (item) =>
        item.enabled &&
        (item.profession === profession.value ||
          item.profession === PROFESSION.GENERAL),
    );
  return getCommandGroups(t, items);
});
```

说明：`useConfig()` 需额外解构 `locale`（`LOCALE.ZH` / `LOCALE.EN` 字符串，`mergeTemplates` 据此选择语言）。若 `useConfig` 未暴露 `locale`，改用 `useI18n()` 的 `locale.value`（值为 `zhCN`/`enUS`，与 `LOCALE` 一致）。

- [ ] **Step 3: 验证旧 i18n 键不再被引用**

`buildTemplateGroup` 已不再使用 `t("EDITOR.SLASH.PM_TEMPLATE.*")`；grep 确认 `SlashMenu.vue` / `templates.ts` 无残留引用，随后在 Task 8 删除旧键。

---

## Task 7: 设置页 TemplateSettings + 编辑弹窗 + SettingsView 注册

**Files:**

- Create: `src/renderer/components/settings/TemplateSettings.vue`
- Create: `src/renderer/components/settings/TemplateEditModal.vue`
- Modify: `src/renderer/components/SettingsView.vue`

- [ ] **Step 1: 编辑弹窗**

```vue
<!-- src/renderer/components/settings/TemplateEditModal.vue -->
<template>
  <n-modal
    v-model:show="show"
    preset="card"
    :title="
      template
        ? t('SETTINGS.TEMPLATE_SETTINGS.EDIT')
        : t('SETTINGS.TEMPLATE_SETTINGS.ADD')
    "
    :style="{ maxWidth: '640px', width: 'calc(100% - 60px)' }"
    :mask-closable="false"
    @after-leave="resetForm"
  >
    <n-form label-placement="left" label-width="90">
      <n-form-item :label="t('SETTINGS.TEMPLATE_SETTINGS.NAME')" required>
        <n-input v-model:value="form.title" />
      </n-form-item>
      <n-form-item :label="t('SETTINGS.TEMPLATE_SETTINGS.DESCRIPTION')">
        <n-input v-model:value="form.description" />
      </n-form-item>
      <n-form-item :label="t('SETTINGS.TEMPLATE_SETTINGS.ICON')">
        <n-input v-model:value="form.icon" placeholder="😀" />
      </n-form-item>
      <n-form-item :label="t('SETTINGS.PROFESSION.LABEL')">
        <n-select
          v-model:value="form.profession"
          :options="professionOptions"
        />
      </n-form-item>
      <n-form-item :label="t('SETTINGS.TEMPLATE_SETTINGS.MARKDOWN')" required>
        <n-input
          v-model:value="form.markdown"
          type="textarea"
          :rows="10"
          placeholder="## 标题&#10;- 内容"
        />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="show = false">{{
          t("SETTINGS.TEMPLATE_SETTINGS.CANCEL")
        }}</n-button>
        <n-button
          type="primary"
          :disabled="!form.title || !form.markdown"
          @click="submit"
        >
          {{ t("SETTINGS.TEMPLATE_SETTINGS.SAVE") }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import { useI18n } from "vue-i18n";
import { PROFESSION, type Profession } from "@/shared/enums";
import type { CustomTemplate } from "@/shared/types/template.types";
import { generateId } from "@/shared/utils/id";

const props = defineProps<{
  show: boolean;
  /** 编辑时传入已有模板；新增时传 null */
  template: CustomTemplate | null;
}>();

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "save", tpl: CustomTemplate): void;
}>();

const { t } = useI18n();

const show = computed({
  get: () => props.show,
  set: (value) => emit("update:show", value),
});

const form = reactive({
  title: "",
  description: "",
  icon: "📄",
  profession: PROFESSION.PM as Profession,
  markdown: "",
});

function resetForm() {
  const base = props.template;
  form.title = base?.title ?? "";
  form.description = base?.description ?? "";
  form.icon = base?.icon ?? "📄";
  form.profession = base?.profession ?? PROFESSION.PM;
  form.markdown = base?.markdown ?? "";
}

// 编辑弹窗刻意包含 GENERAL：允许用户创建「全职业通用」的自定义模板
const professionOptions = (Object.values(PROFESSION) as Profession[]).map(
  (value) => ({
    label: t(`SETTINGS.PROFESSION.OPTION_${value.toUpperCase()}`),
    value,
  }),
);

function submit() {
  const tpl: CustomTemplate = {
    id: props.template?.id ?? `custom_${generateId()}`,
    title: form.title.trim(),
    description: form.description.trim(),
    icon: form.icon.trim() || "📄",
    profession: form.profession,
    markdown: form.markdown,
    enabled: props.template?.enabled ?? true,
  };
  emit("save", tpl);
  show.value = false;
}
</script>
```

- [ ] **Step 2: TemplateSettings 设置页**

```vue
<!-- src/renderer/components/settings/TemplateSettings.vue -->
<template>
  <n-scrollbar class="template-settings">
    <n-card size="medium" :bordered="false" class="setting-card">
      <n-flex align="center" justify="space-between" class="template-toolbar">
        <n-select
          v-model:value="professionFilter"
          class="template-filter"
          :options="professionFilterOptions"
        />
        <n-button type="primary" @click="openAdd">
          {{ t("SETTINGS.TEMPLATE_SETTINGS.ADD") }}
        </n-button>
      </n-flex>

      <n-empty
        v-if="filteredTemplates.length === 0"
        :description="t('SETTINGS.TEMPLATE_SETTINGS.EMPTY')"
        class="template-empty"
      />

      <n-list v-else class="template-list">
        <n-list-item
          v-for="item in filteredTemplates"
          :key="item.id"
          class="template-item"
        >
          <template #prefix>
            <span class="template-icon" v-html="item.icon"></span>
          </template>
          <template #suffix>
            <n-space align="center" :size="12">
              <n-tag size="small" :type="item.builtIn ? 'info' : 'success'">
                {{
                  item.builtIn
                    ? t("SETTINGS.TEMPLATE_SETTINGS.BUILT_IN")
                    : t("SETTINGS.TEMPLATE_SETTINGS.CUSTOM")
                }}
              </n-tag>
              <n-switch
                :value="item.enabled"
                @update:value="(v) => onToggle(item, v)"
              />
              <template v-if="!item.builtIn">
                <n-button size="small" quaternary @click="openEdit(item)">
                  {{ t("SETTINGS.TEMPLATE_SETTINGS.EDIT") }}
                </n-button>
                <n-button
                  size="small"
                  quaternary
                  type="error"
                  @click="onDelete(item)"
                >
                  {{ t("SETTINGS.TEMPLATE_SETTINGS.DELETE") }}
                </n-button>
              </template>
            </n-space>
          </template>
          <n-thing :title="item.title" :description="item.description">
            <template #header-extra>
              <n-tag size="small" :bordered="false">{{
                professionLabel(item.profession)
              }}</n-tag>
            </template>
          </n-thing>
        </n-list-item>
      </n-list>
    </n-card>

    <TemplateEditModal
      v-model:show="editShow"
      :template="editingTemplate"
      @save="onSave"
    />
  </n-scrollbar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useMessage, useDialog } from "naive-ui";
import { PROFESSION, type Profession } from "@/shared/enums";
import type {
  CustomTemplate,
  SlashTemplateItem,
} from "@/shared/types/template.types";
import { useTemplateStore } from "@/renderer/store/template.store";
import { useConfig } from "@/renderer/composables/useConfig";
import TemplateEditModal from "@/renderer/components/settings/TemplateEditModal.vue";

const { t } = useI18n();
const message = useMessage();
const dialog = useDialog();
const templateStore = useTemplateStore();
const { locale } = useConfig();

const professionFilter = ref<Profession | "all">("all");
const editShow = ref(false);
const editingTemplate = ref<CustomTemplate | null>(null);

onMounted(() => {
  templateStore.fetch();
});

const professionFilterOptions = computed(() => [
  { label: t("SETTINGS.TEMPLATE_SETTINGS.ALL_PROFESSIONS"), value: "all" },
  ...(Object.values(PROFESSION) as Profession[]).map((value) => ({
    label: professionLabel(value),
    value,
  })),
]);

const allItems = computed(() => templateStore.allTemplates(locale.value));

const filteredTemplates = computed(() =>
  professionFilter.value === "all"
    ? allItems.value
    : allItems.value.filter(
        (item) => item.profession === professionFilter.value,
      ),
);

function professionLabel(value: Profession): string {
  return t(`SETTINGS.PROFESSION.OPTION_${value.toUpperCase()}`);
}

function openAdd() {
  editingTemplate.value = null;
  editShow.value = true;
}

function openEdit(item: SlashTemplateItem) {
  const source =
    templateStore.file?.customTemplates.find((c) => c.id === item.id) ?? null;
  editingTemplate.value = source
    ? { ...source }
    : {
        id: item.id,
        title: item.title,
        description: item.description,
        icon: item.icon,
        markdown: item.markdown,
        profession: item.profession,
        enabled: item.enabled,
      };
  editShow.value = true;
}

async function onSave(tpl: CustomTemplate) {
  const ok = await templateStore.saveCustom(tpl);
  if (ok) message.success(t("SETTINGS.TEMPLATE_SETTINGS.SAVED"));
  else message.error(t("ERROR.TEMPLATE.SAVE_FAILED"));
}

async function onToggle(item: SlashTemplateItem, enabled: boolean) {
  const ok = await templateStore.setEnabled(item.id, item.builtIn, enabled);
  if (!ok) message.error(t("ERROR.TEMPLATE.SAVE_FAILED"));
}

function onDelete(item: SlashTemplateItem) {
  dialog.warning({
    title: t("SETTINGS.TEMPLATE_SETTINGS.DELETE"),
    content: t("SETTINGS.TEMPLATE_SETTINGS.DELETE_CONFIRM"),
    positiveText: t("ACTION.COMMON.CONFIRM"),
    negativeText: t("ACTION.COMMON.CANCEL"),
    onPositiveClick: async () => {
      const ok = await templateStore.removeCustom(item.id);
      if (ok) message.success(t("SETTINGS.TEMPLATE_SETTINGS.DELETED"));
      else message.error(t("ERROR.TEMPLATE.DELETE_FAILED"));
    },
  });
}
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.template-toolbar {
  margin-bottom: $spacing-md;
}

.template-filter {
  width: 220px;
}

.template-icon {
  font-size: 16px;
}
</style>
```

> 说明：若项目 `ACTION.COMMON` 没有 `CONFIRM`/`CANCEL` 键，回退使用 `SETTINGS.TEMPLATE_SETTINGS.SAVE`/`CANCEL` 文本（见 Task 8 键定义），实施时按现有 i18n 键核对。

- [ ] **Step 3: SettingsView.vue 注册菜单**

新增 import：`import TemplateSettings from "@/renderer/components/settings/TemplateSettings.vue";` 与图标 `import { DocumentTextOutline } from "@vicons/ionicons5";`。

`menuOptions` 增加（放在 keymap 后）：

```ts
{
  key: "template",
  label: t("SETTINGS.TEMPLATE_SETTINGS.TITLE"),
  icon: renderIcon(DocumentTextOutline),
},
```

`componentMap` 增加：`template: markRaw(TemplateSettings),`。

---

## Task 8: i18n 键清理与新增

**Files:**

- Modify: `src/shared/i18n/locales/zhCN.ts`、`enUS.ts`

- [ ] **Step 1: 删除旧键**

删除 `EDITOR.SLASH.PM_TEMPLATE` 整块（两语言同步）：

```diff
- PM_TEMPLATE: {
-   GROUP_LABEL: ...,
-   REQUIREMENT_TITLE: ...,
-   ... 全部 13 个键
- },
```

- [ ] **Step 2: 新增 `EDITOR.SLASH.TEMPLATE`**

```ts
// zhCN
SLASH: {
  // ... 其他
  TEMPLATE: {
    GROUP_LABEL: "职业模板",
  },
},
```

```ts
// enUS
SLASH: {
  // ... 其他
  TEMPLATE: {
    GROUP_LABEL: "Templates",
  },
},
```

- [ ] **Step 3: 新增 `SETTINGS.TEMPLATE_SETTINGS`**

zhCN：

```ts
TEMPLATE_SETTINGS: {
  TITLE: "Slash 模板",
  ADD: "新增模板",
  EDIT: "编辑",
  DELETE: "删除",
  ALL_PROFESSIONS: "全部职业",
  ENABLE: "启用",
  BUILT_IN: "内置",
  CUSTOM: "自定义",
  EMPTY: "暂无模板",
  NAME: "标题",
  DESCRIPTION: "描述",
  ICON: "图标",
  MARKDOWN: "模板内容（Markdown）",
  SAVE: "保存",
  CANCEL: "取消",
  DELETE_CONFIRM: "确定删除该模板？",
  SAVED: "模板已保存",
  DELETED: "模板已删除",
},
```

enUS：

```ts
TEMPLATE_SETTINGS: {
  TITLE: "Slash Templates",
  ADD: "Add Template",
  EDIT: "Edit",
  DELETE: "Delete",
  ALL_PROFESSIONS: "All Professions",
  ENABLE: "Enable",
  BUILT_IN: "Built-in",
  CUSTOM: "Custom",
  EMPTY: "No templates",
  NAME: "Title",
  DESCRIPTION: "Description",
  ICON: "Icon",
  MARKDOWN: "Template Content (Markdown)",
  SAVE: "Save",
  CANCEL: "Cancel",
  DELETE_CONFIRM: "Are you sure you want to delete this template?",
  SAVED: "Template saved",
  DELETED: "Template deleted",
},
```

- [ ] **Step 4: 校验**

`pnpm test tests/unit/shared/locale-keys.test.ts` 通过（两语言键集合一致）。

---

## Task 9: 测试

**Files:**

- Modify: `tests/unit/renderer/slash-templates.test.ts`
- Create: `tests/unit/renderer/template-merge.test.ts`
- Create: `tests/unit/main/template.api.test.ts`

- [ ] **Step 1: 更新 slash-templates.test.ts**

适配新签名与数据：

- `getCommandGroups(t, items)` / `buildTemplateGroup(t, items)`：传入按职业过滤后的 `SlashTemplateItem[]`（用 `mergeTemplates(builtinTemplates, null, LOCALE.ZH)` 结果过滤，或直接构造 item 数组）。
- 断言改为：内置模板数量（18）、`mergeTemplates` 中文解析、按职业分组过滤、enabled=false 的条目不在命令组、空数组返回 null。
- **通用模板断言**：`profession === "general"` 的条目在任一职业过滤下都保留（组内）。

- [ ] **Step 2: template-merge.test.ts**

纯逻辑测试（无需 mock）：

- 中文 locale：内置标题取 `zh`；英文 locale：取 `en`。
- 自定义模板在前、内置在后。
- `disabledTemplateIds` 中的内置模板 `enabled=false`。
- 自定义模板 `enabled` 字段透传。
- `file=null` 时仅返回内置且全部启用。
- 自定义模板的 `builtIn=false`，内置 `builtIn=true`。

- [ ] **Step 3: template.api.test.ts**

参考 `tests/unit/main/config.api.test.ts`（`@vitest-environment node` + `vi.mock("electron")` / `vi.mock("@/main/utils/logger")` / winston mocks）：

- `vi.mock("@/main/core/services/template.service", ...)` 提供 `templateService` mock。
- 断言 4 个 API：成功返回 `response.success(data)`；service 抛错时返回对应 `ErrorCode.TEMPLATE_*`。

---

## Task 10: 验证

- [ ] `pnpm typecheck` 通过（TS strict，无 unused）
- [ ] `pnpm lint` 通过
- [ ] `pnpm test` 全部通过（含 locale-keys、slash-templates、template-merge、template.api）
- [ ] 手动冒烟（可选）：`pnpm dev` 打开设置 → Slash 模板页 → 新增自定义模板 → 保存后到 `<workspace>/templates/slash/templates.json` 检查内容；Slash 菜单按当前职业展示已启用模板；切换语言后内置模板标题/描述/正文切换。
