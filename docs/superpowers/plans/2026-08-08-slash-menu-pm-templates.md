# Slash Menu 职业模板（含 PM）功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 Slash Menu 为「通用命令（仅日期时间）+ 职业模板」结构。模板带 `profession` 职业标签，按当前用户职业过滤展示；先内置 PM 模板，后续可扩展其他职业。

**Architecture:** Slash Menu 命令改为「类型定义 + 分类命令模块 + 注册表」三层。通用命令**只保留日期和时间**（所有职业可用），原「文本格式/块级元素」命令组删除。职业模板以**数据驱动**方式定义，每个模板带 `profession` 标签；`getCommandGroups(t, profession)` 按职业过滤，只返回非空命令组。职业来源为**全局设置**（存入 `config.userInfo.preferences.profession`，默认 `pm`），由 `SlashMenu.vue` 从 config store 读取后传入注册表。

**Tech Stack:** Vue 3 `<script setup>`、Tiptap `@tiptap/core`、`marked`（markdown→HTML）、Naive UI、TypeScript strict、Vitest（happy-dom）。

**关键前置约定（复用现有能力）：**

- 编辑器插入 HTML：TiptapEditor 已用 `marked.parse(md, { async: true })` 实现 Markdown→HTML。模板命令将用**同步** `marked.parse(md)`（静态模板、内容固定）得到 HTML 后 `editor.chain().focus().insertContent(html).run()`。
- 已有工具 `deleteSlashText(editor, pos)` 负责删除 `/查询词`，所有命令执行前必须调用它。
- 保存配置：config store 已有 `setValue(path, value)`（见 `KeymapSettings.vue:91`），职业设置无需新增 IPC。
- i18n：新增键必须在 `zhCN.ts` 与 `enUS.ts` 成对添加，否则 `tests/unit/shared/locale-keys.test.ts` 会失败。
- 新增文件需符合 TS strict（`noUnusedLocals` / `noUnusedParameters`）。

---

## 文件结构

```
src/renderer/components/editor/slash/commands/
├── types.ts                # SlashCommand / CommandGroup / SlashCommandContext（CREATE）
├── helpers.ts              # deleteSlashText / formatDate / formatDateTime / insertMarkdownTemplate（CREATE）
├── registry.ts             # getCommandGroups(t, profession) 注册表（CREATE）
├── dateTime.commands.ts    # 日期和时间（从 SlashMenu 迁移，唯一通用命令组）（CREATE）
└── templates.ts          # Template 定义 + profession 标签 + 按职业过滤 + buildTemplateGroup（CREATE）
```

**新增共享文件：**

- `src/shared/enums/profession.enums.ts` — `PROFESSION` 常量 + `Profession` 类型（CREATE）

**修改文件：**

- `src/shared/types/config.types.ts` — `UserInfo.preferences` 新增 `profession?: Profession`（MODIFY）
- `src/main/constants/config.constants.ts` — `preferences` 默认值新增 `profession: PROFESSION.PM`（MODIFY）
- `src/renderer/components/editor/slash/SlashMenu.vue` — 删除内联命令组 + 格式/块命令，改用注册表并读取职业（MODIFY）
- `src/renderer/components/settings/general/GeneralSettings.vue` — 新增「职业」下拉设置（MODIFY）
- `src/shared/i18n/locales/zhCN.ts`、`enUS.ts` — 新增职业设置与模板分组键（MODIFY）

**测试文件：**

- `tests/unit/renderer/slash-pm-templates.test.ts` — 模板数据、按职业过滤、命令组构建的纯逻辑测试（CREATE）

---

### Task 1: 定义命令类型 `types.ts`

**Files:**

- Create: `src/renderer/components/editor/slash/commands/types.ts`
- Test: `tests/unit/renderer/slash-pm-templates.test.ts`

- [ ] **Step 1: 编写类型定义文件**

```ts
import type { Editor } from "@tiptap/core";

/** 斜杠命令的执行上下文 */
export interface SlashCommandContext {
  editor: Editor;
  /** 触发斜杠的起始位置 */
  pos: number;
}

/** 单个斜杠命令 */
export interface SlashCommand {
  id: string;
  title: string;
  description: string;
  /** 渲染到命令图标的 HTML 字符串 */
  icon: string;
  action: (ctx: SlashCommandContext) => void;
}

/** 命令分组（用于菜单分区展示） */
export interface CommandGroup {
  id: string;
  label: string;
  items: SlashCommand[];
}
```

---

### Task 2: 提取通用工具 `helpers.ts`

**Files:**

- Create: `src/renderer/components/editor/slash/commands/helpers.ts`
- Test: `tests/unit/renderer/slash-pm-templates.test.ts`

- [ ] **Step 1: 编写工具函数**

将 `SlashMenu.vue` 中的 `deleteSlashText`、`formatDate`、`formatDateTime` 原样迁移，并新增 `insertMarkdownTemplate`。

```ts
import type { Editor } from "@tiptap/core";
import { marked } from "marked";

/** 删除斜杠及后面的查询文本 */
export function deleteSlashText(editor: Editor, pos: number) {
  const { state } = editor;
  const { doc } = state;
  let endPos = pos;
  while (endPos < doc.content.size) {
    const char = doc.textBetween(endPos, endPos + 1);
    if (char === " " || char === "\n") break;
    endPos++;
  }
  if (endPos === pos) {
    const textBefore = doc.textBetween(Math.max(0, pos - 10), pos);
    const slashIdx = textBefore.lastIndexOf("/");
    if (slashIdx >= 0) {
      const actualStart = Math.max(0, pos - 10) + slashIdx;
      editor.chain().focus().deleteRange({ from: actualStart, to: pos }).run();
      return;
    }
  }
  editor
    .chain()
    .focus()
    .deleteRange({ from: pos - 1, to: endPos })
    .run();
}

/** 格式化日期为 YYYY-MM-DD */
export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 格式化日期时间为 YYYY-MM-DD HH:mm:ss */
export function formatDateTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${formatDate(d)} ${h}:${min}:${s}`;
}

/**
 * 将 Markdown 模板转为 HTML 并插入编辑器光标位置。
 * 先删除 /查询词，再插入模板内容。
 */
export function insertMarkdownTemplate(
  editor: Editor,
  pos: number,
  markdown: string,
): void {
  deleteSlashText(editor, pos);
  const html = marked.parse(markdown) as string;
  editor.chain().focus().insertContent(html).run();
}
```

> 说明：`marked.parse` 在未传 `{ async: true }` 时同步返回字符串。模板为静态内容，无需异步。

---

### Task 3: 迁移「日期和时间」命令组（唯一通用命令组）

**Files:**

- Create: `src/renderer/components/editor/slash/commands/dateTime.commands.ts`
- Test: `tests/unit/renderer/slash-pm-templates.test.ts`

> 说明：按新需求，Slash Menu 通用命令**只保留日期和时间**。「文本格式」「块级元素」命令组整体删除，不再迁移。

- [ ] **Step 1: 迁移日期和时间命令组**

```ts
// dateTime.commands.ts
import type { CommandGroup, SlashCommand } from "./types";
import { deleteSlashText, formatDate, formatDateTime } from "./helpers";

function dt(
  id: string,
  title: string,
  description: string,
  icon: string,
  insert: () => string,
): SlashCommand {
  return {
    id,
    title,
    description,
    icon,
    action: ({ editor, pos }) => {
      deleteSlashText(editor, pos);
      editor.chain().focus().insertContent(insert()).run();
    },
  };
}

export const dateTimeCommandGroup: CommandGroup = {
  id: "dateTime",
  label: "日期和时间",
  items: [
    dt(
      "today",
      "今天",
      "插入今天日期",
      '<span style="font-size:14px">📅</span>',
      () => formatDate(new Date()),
    ),
    dt(
      "yesterday",
      "昨天",
      "插入昨天日期",
      '<span style="font-size:14px">📅</span>',
      () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return formatDate(d);
      },
    ),
    dt(
      "tomorrow",
      "明天",
      "插入明天日期",
      '<span style="font-size:14px">📅</span>',
      () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return formatDate(d);
      },
    ),
    dt(
      "currentTime",
      "当前时间",
      "插入当前日期和时间",
      '<span style="font-size:14px">🕐</span>',
      () => formatDateTime(new Date()),
    ),
    dt(
      "datePicker",
      "日期选择",
      "选择自定义日期插入",
      '<span style="font-size:14px">🗓️</span>',
      () => {
        const today = formatDate(new Date());
        return window.prompt("选择日期 (YYYY-MM-DD)", today) ?? "";
      },
    ),
  ],
};
```

---

### Task 4: 新增职业枚举与配置字段

**Files:**

- Create: `src/shared/enums/profession.enums.ts`
- Modify: `src/shared/types/config.types.ts:24-29`
- Modify: `src/main/constants/config.constants.ts:22-30`

- [ ] **Step 1: 创建职业枚举**

```ts
// src/shared/enums/profession.enums.ts
/** 职业枚举：后续新增职业在此追加，模板通过 profession 标签归类 */
export const PROFESSION = {
  PM: "pm",
} as const;

export type Profession = (typeof PROFESSION)[keyof typeof PROFESSION];
```

- [ ] **Step 2: 在配置类型 `UserInfo.preferences` 新增 `profession`**

在 `src/shared/types/config.types.ts` 的 `UserInfo.preferences` 对象内新增字段（并 import `Profession`）：

```ts
import {
  ThemeMode,
  ThemeColor,
  Locale,
  UpdateChannel,
  Profession,
} from "@/shared/enums/config.enums";

// UserInfo.preferences 内新增：
preferences: {
  country?: string;
  timezone: string;
  notification: boolean;
  profession?: Profession; // 当前用户职业，决定 Slash Menu 展示哪套模板
};
```

> 说明：项目 enums 均从 `@/shared/enums` 统一导出，`Profession` 需同步在 `src/shared/enums/index.ts` 中 `export * from "./profession.enums"`。

- [ ] **Step 3: 设置默认职业为 `pm`**

在 `src/main/constants/config.constants.ts` 的 `DEFAULT_APP_CONFIG.userInfo.preferences` 内新增（并 import `PROFESSION`）：

```ts
preferences: {
  country: "中国",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  notification: true,
  profession: PROFESSION.PM,
},
```

---

### Task 5: 编写职业模板数据与命令组 `templates.ts`

**Files:**

- Create: `src/renderer/components/editor/slash/commands/templates.ts`
- Test: `tests/unit/renderer/slash-pm-templates.test.ts`

- [ ] **Step 1: 定义模板接口与按职业过滤**

模板带 `profession` 标签。`getTemplatesByProfession` 负责过滤，新增职业只需扩展 `templates` 数组并给新模板打上对应标签。

```ts
// templates.ts
import type { CommandGroup } from "./types";
import type { Profession } from "@/shared/enums/profession.enums";
import { insertMarkdownTemplate } from "./helpers";

/** PM 模板的纯数据定义 */
export interface Template {
  id: string;
  /** 所属职业标签（用于按职业过滤） */
  profession: Profession;
  /** i18n 键，用于标题（如 EDITOR.SLASH.PM_TEMPLATE.PRD_TITLE） */
  titleKey: string;
  /** i18n 键，用于描述 */
  descKey: string;
  /** 图标 HTML */
  icon: string;
  /** 模板 Markdown 骨架 */
  markdown: string;
}

/** 按职业过滤模板 */
export function getTemplatesByProfession(
  templates: Template[],
  profession: Profession,
): Template[] {
  return templates.filter((tpl) => tpl.profession === profession);
}
```

- [ ] **Step 2: 内置 PM 模板清单（全部带 `profession: "pm"`）**

新增模板只需向 `templates` 追加一项并标上职业标签：

```ts
/** 内置模板清单（新增模板在此追加一项即可） */
export const templates: Template[] = [
  {
    id: "prd",
    profession: "pm",
    titleKey: "EDITOR.SLASH.PM_TEMPLATE.PRD_TITLE",
    descKey: "EDITOR.SLASH.PM_TEMPLATE.PRD_DESC",
    icon: '<span style="font-size:14px">📋</span>',
    markdown: `# 《功能》产品需求文档（PRD）

## 1. 背景与目标
- 背景：
- 业务目标：
- 成功指标（可量化）：

## 2. 用户与场景
- 目标用户：
- 核心场景：

## 3. 功能需求
### 3.1 功能概述
- 功能名称：
- 优先级（P0/P1/P2）：

### 3.2 用户故事
- 作为____，我希望____，以便____

### 3.3 详细需求
- 需求描述：
- 交互说明：

## 4. 异常与边界
- 异常场景：
- 边界条件：

## 5. 数据与埋点
- 关键指标：
- 埋点事件：

## 6. 验收标准
- [ ] 验收项 1
- [ ] 验收项 2
`,
  },
  {
    id: "mrd",
    profession: "pm",
    titleKey: "EDITOR.SLASH.PM_TEMPLATE.MRD_TITLE",
    descKey: "EDITOR.SLASH.PM_TEMPLATE.MRD_DESC",
    icon: '<span style="font-size:14px">📊</span>',
    markdown: `# 《产品》市场需求文档（MRD）

## 1. 市场分析
- 市场现状：
- 市场规模与趋势：

## 2. 用户需求
- 目标人群：
- 痛点与需求：

## 3. 竞争分析
- 主要竞品：
- 差异化定位：

## 4. 产品定位
- 价值主张：
- 核心卖点：

## 5. 市场策略
- 目标市场：
- 进入策略：
`,
  },
  {
    id: "competitor",
    profession: "pm",
    titleKey: "EDITOR.SLASH.PM_TEMPLATE.COMPETITOR_TITLE",
    descKey: "EDITOR.SLASH.PM_TEMPLATE.COMPETITOR_DESC",
    icon: '<span style="font-size:14px">🔍</span>',
    markdown: `# 《竞品》分析报告

## 1. 产品概述
- 产品定位：
- 目标用户：
- 商业模式：

## 2. 功能对比
| 功能模块 | 竞品 | 我方 | 差异 |
| :--- | :--- | :--- | :--- |
|  |  |  |  |

## 3. 用户反馈
- 正面反馈：
- 负面反馈：

## 4. 优势与劣势
- 竞品优势：
- 竞品劣势：

## 5. 结论与建议
- 机会点：
- 应对策略：
`,
  },
  {
    id: "meeting",
    profession: "pm",
    titleKey: "EDITOR.SLASH.PM_TEMPLATE.MEETING_TITLE",
    descKey: "EDITOR.SLASH.PM_TEMPLATE.MEETING_DESC",
    icon: '<span style="font-size:14px">📝</span>',
    markdown: `# 会议纪要 - 《主题》

## 时间与参与人
- 时间：
- 参与人：

## 讨论内容
- 议题 1：
- 议题 2：

## 决策
- 决策 1：
- 决策 2：

## 行动项
- [ ] @负责人 事项，截止日期：

## 风险与待跟进
- 风险：
- 待跟进：
`,
  },
  {
    id: "roadmap",
    profession: "pm",
    titleKey: "EDITOR.SLASH.PM_TEMPLATE.ROADMAP_TITLE",
    descKey: "EDITOR.SLASH.PM_TEMPLATE.ROADMAP_DESC",
    icon: '<span style="font-size:14px">🗺️</span>',
    markdown: `# 《产品》版本规划（Roadmap）

## 季度目标
- Q1：
- Q2：

## 需求池
- [ ] P0 需求
- [ ] P1 需求

## 版本排期
### V1.0
- 功能：
- 时间：

### V1.1
- 功能：
- 时间：

## 资源与风险
- 资源约束：
- 主要风险：
`,
  },
];
```

- [ ] **Step 3: 构建命令组（按职业过滤，空则返回 null）**

```ts
/** 由模板数组 + 职业构建 Slash 命令组；无匹配模板时返回 null */
export function buildTemplateGroup(
  t: (key: string) => string,
  profession: Profession,
): CommandGroup | null {
  const matched = getTemplatesByProfession(templates, profession);
  if (matched.length === 0) return null;
  return {
    id: "template",
    label: t("EDITOR.SLASH.PM_TEMPLATE.GROUP_LABEL"),
    items: matched.map((tpl) => ({
      id: tpl.id,
      title: t(tpl.titleKey),
      description: t(tpl.descKey),
      icon: tpl.icon,
      action: ({ editor, pos }) => {
        insertMarkdownTemplate(editor, pos, tpl.markdown);
      },
    })),
  };
}
```

> 说明：`buildTemplateGroup` 接收 `t`（i18n 翻译函数）把 `titleKey/descKey` 解析为本地化文本，并按 `profession` 过滤。未来新增职业只需扩展 `templates` 数组，无需改动本函数。

---

### Task 6: 注册表 `registry.ts`

**Files:**

- Create: `src/renderer/components/editor/slash/commands/registry.ts`

- [ ] **Step 1: 合并命令组（通用 + 职业模板）**

```ts
// registry.ts
import type { CommandGroup } from "./types";
import type { Profession } from "@/shared/enums/profession.enums";
import { dateTimeCommandGroup } from "./dateTime.commands";
import { buildTemplateGroup } from "./templates";

export type { SlashCommand, CommandGroup, SlashCommandContext } from "./types";

/** 全局命令组注册表：通用命令固定返回，职业模板按 profession 动态追加 */
export function getCommandGroups(
  t: (key: string) => string,
  profession: Profession,
): CommandGroup[] {
  const groups: CommandGroup[] = [dateTimeCommandGroup];
  const pmGroup = buildTemplateGroup(t, profession);
  if (pmGroup) groups.push(pmGroup);
  return groups;
}
```

> 设计：`getCommandGroups(t, profession)` 接收 i18n 翻译函数与当前职业。通用命令（日期时间）固定返回，模板组按职业过滤且仅在非空时追加，保证命令组顺序可控。

---

### Task 7: 改造 `SlashMenu.vue` 使用注册表并读取职业

**Files:**

- Modify: `src/renderer/components/editor/slash/SlashMenu.vue`

- [ ] **Step 1: 删除内联命令组与本地工具函数**

在 `<script setup>` 中：

1. 删除整个 `commandGroups` 数组（含「文本格式」「基本类型」「日期和时间」「块级元素」全部内联定义，约 380 行）。
2. 删除本地 `formatDate`、`formatDateTime`、`deleteSlashText` 函数（已迁移到 helpers）。

- [ ] **Step 2: 引入注册表、useConfig、useI18n，用 computed 生成命令组**

```ts
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
} from "vue";
import { NInput, NScrollbar, NEmpty } from "naive-ui";
import { useI18n } from "vue-i18n";
import type { Editor } from "@tiptap/core";
import { useConfig } from "@/renderer/composables/useConfig";
import { getCommandGroups, type CommandGroup } from "./commands/registry";
import type { SlashCommand } from "./commands/types";

const { t } = useI18n();
const { profession } = useConfig();

// 命令组来自注册表：通用(日期时间) + 当前职业模板
const commandGroups = computed<CommandGroup[]>(() =>
  getCommandGroups(t, profession.value),
);
```

> 注意：需在 `useConfig` 中确认存在 `profession` 的 computed 导出（见 Task 4 后补），若无则在 `useConfig.ts` 中新增 `const profession = computed(() => userInfo.value?.preferences?.profession ?? PROFESSION.PM)`。

- [ ] **Step 3: 同步调整对 `commandGroups` 的引用**

`filteredGroups`、`getGlobalIndex`、`totalItems` 原引用 `commandGroups`（现在是 `computed`），改为使用 `commandGroups.value`：

```ts
function getGlobalIndex(gi: number, ci: number): number {
  let idx = 0;
  for (let i = 0; i < gi; i++) {
    idx += commandGroups.value[i].items.length;
  }
  return idx + ci;
}

const filteredGroups = computed(() => {
  const q = searchText.value.toLowerCase().trim();
  if (!q) return commandGroups.value;
  return commandGroups.value
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (cmd) =>
          cmd.title.toLowerCase().includes(q) ||
          cmd.description.toLowerCase().includes(q) ||
          cmd.id.toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.items.length > 0);
});

const totalItems = computed(() => {
  let count = 0;
  for (const g of filteredGroups.value) {
    count += g.items.length;
  }
  return count;
});
```

- [ ] **Step 4: `executeCommand` 适配新 action 签名**

```ts
function executeCommand(cmd: SlashCommand) {
  cmd.action({ editor: props.editor, pos: props.startPos });
  emit("close");
}
```

---

### Task 8: 在设置面板新增「职业」下拉

**Files:**

- Modify: `src/renderer/components/settings/general/GeneralSettings.vue`

- [ ] **Step 1: 新增职业选择行（仿照 KeymapSettings 的 `configStore.setValue` 模式）**

在模板合适位置（如用户信息区）新增一行，`n-select` 展示职业选项：

```vue
<n-flex align="center" class="setting-row">
  <n-flex align="center" class="setting-content">
    <n-text class="setting-label">{{ t("SETTINGS.PROFESSION.LABEL") }}</n-text>
    <n-text class="setting-desc">{{ t("SETTINGS.PROFESSION.DESC") }}</n-text>
  </n-flex>
  <n-select
    :value="profession"
    :options="professionOptions"
    size="small"
    style="width: 160px"
    @update:value="onProfessionChange"
  />
</n-flex>
```

- [ ] **Step 2: script 中补充职业逻辑**

```ts
import { PROFESSION, type Profession } from "@/shared/enums/profession.enums";

const professionOptions = [
  { label: t("SETTINGS.PROFESSION.OPTION_PM"), value: PROFESSION.PM },
];

const onProfessionChange = async (value: Profession) => {
  await configStore.setValue("userInfo.preferences.profession", value);
  message.success(t("SETTINGS.PROFESSION.SAVED"));
};
```

> 说明：`profession` 从 `useConfig` 解构（与 Task 7 同源）。`configStore.setValue` 支持点路径，将职业持久化到 `config/userInfo.preferences.profession`，无需新增 IPC。后续新增职业只需在 `professionOptions` 加一项并在 `PROFESSION` 枚举加值。

---

### Task 9: 新增 i18n 键（中英文成对）

**Files:**

- Modify: `src/shared/i18n/locales/zhCN.ts`
- Modify: `src/shared/i18n/locales/enUS.ts`

- [ ] **Step 1: `zhCN.ts` 中把 `EDITOR` 改为对象并新增 `SLASH`**

`EDITOR` 当前为字符串 `"编辑器"`（zhCN.ts:168），改为对象：

```ts
EDITOR: {
  SLASH: {
    PM_TEMPLATE: {
      GROUP_LABEL: "PM 模板",
      PRD_TITLE: "产品需求文档（PRD）",
      PRD_DESC: "插入 PRD 文档模板",
      MRD_TITLE: "市场需求文档（MRD）",
      MRD_DESC: "插入 MRD 文档模板",
      COMPETITOR_TITLE: "竞品分析报告",
      COMPETITOR_DESC: "插入竞品分析模板",
      MEETING_TITLE: "会议纪要",
      MEETING_DESC: "插入会议纪要模板",
      ROADMAP_TITLE: "版本规划（Roadmap）",
      ROADMAP_DESC: "插入版本规划模板",
    },
  },
},
```

- [ ] **Step 2: `zhCN.ts` 中新增职业设置键**

```ts
SETTINGS: {
  PROFESSION: {
    LABEL: "职业",
    DESC: "当前职业决定 Slash Menu 展示的模板",
    OPTION_PM: "产品经理（PM）",
    SAVED: "职业设置已保存",
  },
  // ...原有 SETTINGS 内容保留
},
```

- [ ] **Step 3: `enUS.ts` 添加完全相同键名的英文翻译**

```ts
EDITOR: {
  SLASH: {
    PM_TEMPLATE: {
      GROUP_LABEL: "PM Templates",
      PRD_TITLE: "Product Requirements Doc (PRD)",
      PRD_DESC: "Insert PRD template",
      MRD_TITLE: "Market Requirements Doc (MRD)",
      MRD_DESC: "Insert MRD template",
      COMPETITOR_TITLE: "Competitor Analysis",
      COMPETITOR_DESC: "Insert competitor analysis template",
      MEETING_TITLE: "Meeting Minutes",
      MEETING_DESC: "Insert meeting minutes template",
      ROADMAP_TITLE: "Roadmap",
      ROADMAP_DESC: "Insert roadmap template",
    },
  },
},
```

```ts
SETTINGS: {
  PROFESSION: {
    LABEL: "Profession",
    DESC: "Current profession determines templates shown in Slash Menu",
    OPTION_PM: "Product Manager (PM)",
    SAVED: "Profession saved",
  },
  // ...原有 SETTINGS 内容保留
},
```

> 注意：需确认 `t("EDITOR")` 未在别处被当作字符串使用；改造为对象后安全。`locale-keys.test.ts` 要求中英键名完全一致。

---

### Task 10: 编写并运行测试

**Files:**

- Create: `tests/unit/renderer/slash-pm-templates.test.ts`

- [ ] **Step 1: 编写模板数据、按职业过滤与命令组构建测试**

```ts
import { describe, it, expect } from "vitest";
import { PROFESSION } from "@/shared/enums/profession.enums";
import {
  templates,
  getTemplatesByProfession,
  buildTemplateGroup,
} from "@/renderer/components/editor/slash/commands/templates";

const fakeT = (key: string) => `key:${key}`;

describe("PM templates", () => {
  it("should have unique ids", () => {
    const ids = templates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each template has profession, markdown, icon and i18n keys", () => {
    for (const tpl of templates) {
      expect(tpl.profession).toBe(PROFESSION.PM);
      expect(tpl.markdown.length).toBeGreaterThan(0);
      expect(tpl.icon).toBeTruthy();
      expect(tpl.titleKey.startsWith("EDITOR.SLASH.PM_TEMPLATE.")).toBe(true);
      expect(tpl.descKey.startsWith("EDITOR.SLASH.PM_TEMPLATE.")).toBe(true);
    }
  });

  it("getTemplatesByProfession filters by profession", () => {
    expect(getTemplatesByProfession(templates, PROFESSION.PM).length).toBe(
      templates.length,
    );
    // 未定义的职业应返回空
    expect(getTemplatesByProfession(templates, "unknown" as never).length).toBe(
      0,
    );
  });

  it("buildTemplateGroup returns translated commands for pm, null for unmatched", () => {
    const group = buildTemplateGroup(fakeT, PROFESSION.PM);
    expect(group?.id).toBe("template");
    expect(group?.items.length).toBe(templates.length);
    expect(group?.items[0].title).toBe(`key:${templates[0].titleKey}`);
    expect(buildTemplateGroup(fakeT, "unknown" as never)).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试确认通过**

Run: `pnpm test -- tests/unit/renderer/slash-pm-templates.test.ts`
Expected: 4 tests PASS

---

### Task 11: 全量校验（typecheck / lint / test）

**Files:**

- No new files

- [ ] **Step 1: 类型检查**

Run: `pnpm typecheck`
Expected: 无错误。若 `noUnusedLocals` / `noUnusedParameters` 报错，删除未使用的 import。

- [ ] **Step 2: 构建验证**

Run: `pnpm build`（内部含 `vue-tsc` + `vite build`）
Expected: 构建成功。

- [ ] **Step 3: 回归测试**

Run: `pnpm test`
Expected: 全部通过（含 `locale-keys.test.ts` 与新增测试）。

- [ ] **Step 4: 手动验证**

Run: `pnpm dev`

- 打开任一 Journal 编辑器，输入 `/` 唤起 Slash Menu。
- 确认只出现「日期和时间」与「PM 模板」两组（无格式/块命令）。
- 选中任一模板，确认删除 `/查询词` 并插入完整 Markdown 骨架。
- 在设置面板切换职业为 PM，确认 PM 模板组出现；若职业未设置/未知，模板组不出现。
- 切换界面语言（中/英），确认模板标题、描述与分组标签随语言变化。

---

## Self-Review

**1. Spec 覆盖：**

- "只保留日期和时间（通用所有职业）"→ Task 3（仅迁移日期时间）+ Task 6（注册表仅含日期时间+模板）+ Task 7（删除格式/块命令）。✅
- "模板增加职业标签，按职业获得适合的模板"→ Task 4（职业枚举/配置）+ Task 5（`profession` 字段 + `getTemplatesByProfession` + `buildTemplateGroup(t, profession)`）。✅
- "后续规划增加其他职业"→ 职业枚举可扩展 + 模板数组追加 + 设置下拉加项，均数据驱动。✅
- 现有日期时间功能不回归→ Task 2/3 迁移、Task 7 保持执行逻辑。✅

**2. 占位符扫描：** 无 "TBD/TODO/implement later"；每个代码步骤均给出完整代码。✅

**3. 类型一致性：**

- `SlashCommand.action` 统一为 `(ctx: SlashCommandContext) => void`，`executeCommand` 调用 `cmd.action({ editor, pos })` 一致。✅
- `buildTemplateGroup(t, profession)` 与 `getCommandGroups(t, profession)` 签名一致（均接收 `profession`）。✅
- `buildTemplateGroup` 返回 `CommandGroup | null`，注册表用 `if (pmGroup)` 判空。✅
- `getTemplatesByProfession(templates, profession)` 与 `buildTemplateGroup` 内调用参数一致。✅
- `Profession` 类型在 Task 4 定义、Task 5/6/8 使用，路径 `@/shared/enums/profession.enums` 一致。✅
- `profession` 配置字段在 config 类型/默认值/设置/useConfig 中命名一致。✅

**执行注意事项（提示实施者）：**

- `useConfig` 当前可能无 `profession` 的 computed 导出，需在 Task 7/8 前于 `useConfig.ts` 补一个（Task 7 Step 2 已注明）。
- `src/shared/enums/index.ts` 需 `export * from "./profession.enums"`。
- 删除「文本格式/块级元素」命令后，若编辑器其他入口仍依赖这些格式（如工具栏），不受影响——仅斜杠菜单移除，勿误删 Tiptap 扩展。
- 现有 SlashMenu 中 4 个 `onMounted` 中有 2 个重复（主题与 locale），迁移时保留即可，非本计划范围。
