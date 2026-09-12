# 模板市场功能方案与实施计划（v2：三类型 + 仅打包通用模板）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施本计划。步骤使用 checkbox（`- [ ]`）语法跟踪。

**Goal:** 新增「模板市场」独立页面（参考 Obsidian 插件市场交互），覆盖三类资源（命令模板 / 页面模板 / 技能模板）；内置打包只含通用模板（职业模板不打包，改由市场按需安装）；「设置 → 模板」重新设计为含市场入口、检查更新、新建自定义模板、已安装模板列表的管理页；三类资源同步均改为「选择性安装」。

**Architecture:** 主进程新增已安装清单（`<workspace>/resources/installed.json`，含 slash/page/skill 三类）与模板市场服务（目录拉取/安装/卸载/更新检测），改造 `ResourceSyncService.checkAndSync()` 使其只同步「已安装的三类资源」；打包与首启复制均过滤为仅通用模板；渲染层新增 `/marketplace` 路由页面（三类型 Tab + 搜索 + 标签筛选 + 卡片 + 展开详情），设置页增加市场入口。数据链路复用现有 GitHub raw + manifest + sha256 校验。

**Tech Stack:** Electron + Vue 3（Composition API / `<script setup>`）+ Pinia + Naive UI + vue-router + i18n（zhCN/enUS）+ Vitest（happy-dom + node）。

---

## 一、背景与目标

### 1.1 现状

- 三类远程资源，`resources/` 下 `slash/*.json`（命令模板）、`page/*.json`（页面模板）、`skills/*.skill.json`（技能），元数据统一记录在 `resources/manifest.json`（type/path/version/sha256）。模板含 `profession[]`（如 `["writer"]`、`["general"]`），技能含 `category[]` 且无 profession。
- 打包：`vite.config.mts copyResources()` 把整个 `resources/` 复制到 `dist-electron/resources`；首启 `workspace-init.ensureResourcesCopied()` 再整体复制到 `<workspace>/resources/`。
- `ResourceSyncService.checkAndSync()` 启动时拉取远程 manifest 对比本地 manifest，**全量下载**变更文件并 sha256 校验，广播 `resource:updated`。
- 设置页「模板」（`TemplateSettings.vue`）：新建（命令/页面）、检查模板更新（syncNow）、Tab、职业筛选、数据表。
- 渲染层 `template.store.ts` 按类型懒加载自定义 + 内置模板并合并；Slash 菜单与新建页面弹窗共用。

### 1.2 目标

1. **仅打包通用模板**：`profession` 含 `general`（或缺失/为空）的命令/页面模板随应用打包；职业模板（writer/pm/student/developer/researcher 等）**不打包**，从市场按需安装。技能全部打包（无职业区分）。
2. **选择性安装（三类统一）**：命令模板、页面模板、技能模板均通过市场安装/卸载/更新；同步只下载已安装的资源。
3. **模板市场独立页面**（新路由 `/marketplace`）：按类型 Tab 分别查看（命令模板 / 页面模板 / 技能模板），搜索、按标签快速筛选、按当前语言自动显示中英文、卡片展示（名称/描述/版本/标签）、点击卡片展开详情。
4. **设置-模板管理重新设计**：含「进入模板市场」入口、「检查更新」、「新建自定义模板」、「已安装的模板列表」。

### 1.3 参考交互（Obsidian 社区插件市场）

- 列表卡片展示名称、描述、版本、标签，卡片含状态与操作（安装/已安装/更新）。
- 点击卡片展开详情（描述、版本、预览、操作按钮）。
- 顶部搜索框 + 分类标签快速筛选。
- 设置内「已安装列表」与「市场」分离：市场管安装/卸载/更新，设置管启用/停用与自定义模板编辑。

## 二、设计决策

| 决策点         | 选择                                                                                                             | 理由                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 打包范围       | 仅打包 profession 含 general 的模板 + 全部技能 + schemas + manifest                                              | 用户要求；职业模板只存在于远程，经市场安装      |
| 过滤落点       | ① `vite.config.mts copyResources()`（产物）② `workspace-init.ensureResourcesCopied()`（首启种子，覆盖 dev/prod） | 保证产物与开发态行为一致                        |
| 安装模型       | 选择性安装（slash/page/skill 三类统一）                                                                          | 用户确认；市场三类 Tab 需要一致的安装/卸载语义  |
| 已安装清单     | `<workspace>/resources/installed.json`，键为 `slash`/`page`/`skill`                                              | 与资源目录同层，随工作区持久化                  |
| 首次同步快照   | installed.json 缺失时，快照 = **本地已存在文件**对应的条目（即打包的通用模板 + 全部技能）                        | 职业模板默认未安装，老用户已有文件不丢失        |
| 市场数据源     | 远程 manifest 优先，失败回退本地 manifest（离线降级）                                                            | 有网时完整目录 + 更新信息；离线至少看到已安装项 |
| 未安装资源内容 | 拉取目录时并行下载各 JSON（约 40 个小文件）                                                                      | 无需新增远程基础设施；卡片与详情预览数据齐备    |
| 目录缓存       | 主进程内存缓存，TTL 60s，安装/卸载/同步/刷新时失效                                                               | 避免频繁请求 GitHub（60 次/小时限流）           |
| 市场页面形态   | MenuLayout 下新路由全页                                                                                          | 「独立布局页面」= 全页而非设置弹窗              |
| 市场入口       | 设置-模板管理页内「进入模板市场」按钮（关闭设置弹窗后跳转）                                                      | 用户确认                                        |
| 版本比较       | 复用 `src/main/utils/version.ts` 的 `compareVersions`（主进程计算 updateAvailable）                              | 渲染层无需重复实现                              |

## 三、数据结构

### 3.1 共享类型（`src/shared/types/template.types.ts` 新增）

```ts
import type { ResourceType } from "@/shared/enums/resource.enums";
import type { TemplateIconName } from "@/shared/enums/template.enums";

/** 已安装资源清单（<workspace>/resources/installed.json），键为资源类型，值为 id 列表 */
export type InstalledResourceList = Partial<Record<ResourceType, string[]>>;

/** 模板市场条目（远程 manifest 元数据 + 文件内容 + 本地安装状态合并，三类资源通用） */
export interface MarketplaceItem {
  id: string;
  type: ResourceType; // slash | page | skill
  /** 远程最新版本 */
  version: string;
  title: LocalizedText;
  description: LocalizedText;
  /** 模板为图标名；技能为 emoji 字符串 */
  icon: string;
  tags: LocalizedText[];
  /** 预览内容：模板为 markdown，技能为 promptTemplate */
  preview: LocalizedText;
  /** 适用职业（仅命令/页面模板；技能为空数组） */
  profession: Profession[];
  /** 本地是否已安装（本地存在对应资源文件） */
  installed: boolean;
  /** 本地已安装版本（未安装为空串） */
  installedVersion: string;
  /** 是否有可用更新（已安装且本地版本 < 远程版本） */
  updateAvailable: boolean;
}

/** 模板市场目录（一次拉取的结果） */
export interface MarketplaceCatalog {
  items: MarketplaceItem[];
  /** 远程 manifest 是否拉取成功（false = 离线降级，仅本地已安装数据） */
  offline: boolean;
}
```

### 3.2 共享工具（`src/shared/utils/resource.ts` 新增）

```ts
import { RESOURCE_TYPE } from "@/shared/enums/resource.enums";

/** 从 manifest 条目路径解析资源 id：
 *  "slash/article.json" → "article"
 *  "page/page-prd.json" → "page-prd"
 *  "skills/polish.skill.json" → "polish"
 */
export function resourceIdFromPath(entryPath: string, type: string): string {
  let base = entryPath.split("/").pop() ?? entryPath;
  if (base.endsWith(".json")) base = base.slice(0, -".json".length);
  if (type === RESOURCE_TYPE.SKILL && base.endsWith(".skill")) {
    base = base.slice(0, -".skill".length);
  }
  return base;
}

/** 由类型与 id 反推 manifest 相对路径（安装/卸载用） */
export function resourcePathFromId(type: string, id: string): string {
  return type === RESOURCE_TYPE.SKILL
    ? `skills/${id}.skill.json`
    : `${type}/${id}.json`;
}
```

### 3.3 installed.json 文件格式

```json
{
  "slash": ["brainstorm", "daily-review", "todo"],
  "page": ["page-reading-notes", "page-weekly-report"],
  "skill": ["polish", "expand", "summarize"]
}
```

### 3.4 打包范围示例（resources 现状 → 打包产物）

| 资源                                                                  | 打包 | 说明                                      |
| --------------------------------------------------------------------- | ---- | ----------------------------------------- |
| `slash/brainstorm.json`、`slash/daily-review.json`、`slash/todo.json` | ✅   | profession 含 general                     |
| `page/page-reading-notes.json`、`page/page-weekly-report.json`        | ✅   | profession 含 general                     |
| `slash/article.json`、`slash/meeting.json` 等其余 13 个               | ❌   | writer/pm/student/developer/researcher 等 |
| `page/page-prd.json` 等其余 3 个                                      | ❌   | 同上                                      |
| `skills/*.skill.json`（11 个）                                        | ✅   | 技能无职业区分，全量打包                  |
| `manifest.json`、`schemas/*`                                          | ✅   | 元数据与校验 schema                       |

## 四、文件结构

| 文件                                                                          | 职责                                                                    | 操作 |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---- |
| `src/shared/types/template.types.ts`                                          | 新增 `InstalledResourceList` / `MarketplaceItem` / `MarketplaceCatalog` | 修改 |
| `src/shared/utils/resource.ts`                                                | `resourceIdFromPath` / `resourcePathFromId`                             | 新增 |
| `src/main/core/services/template-installed.service.ts`                        | 已安装清单读写/快照/清理（三类）                                        | 新增 |
| `src/main/core/services/base/workspace-init.service.ts`                       | 首启复制过滤为仅通用模板                                                | 修改 |
| `vite.config.mts`                                                             | `copyResources()` 过滤为仅通用模板                                      | 修改 |
| `src/main/core/services/resource-sync.service.ts`                             | 同步改为选择性（三类均按已安装清单）                                    | 修改 |
| `src/main/core/services/template-market.service.ts`                           | 市场目录/安装/卸载/更新检测 + 内存缓存（三类）                          | 新增 |
| `src/main/core/apis/template.api.ts`                                          | 市场三个 API                                                            | 修改 |
| `src/main/ipcMain/template.ipc.ts`                                            | 三个市场 IPC handler                                                    | 修改 |
| `src/main/preload/modules/template.ts` / `src/main/preload/types/template.ts` | 三个市场方法桥接                                                        | 修改 |
| `src/renderer/store/template.store.ts`                                        | 市场目录状态 + 安装/卸载动作 + 失效（三类）                             | 修改 |
| `src/renderer/components/marketplace/marketplace-filter.ts`                   | 搜索 + 标签筛选纯函数                                                   | 新增 |
| `src/renderer/components/marketplace/TemplateCard.vue`                        | 资源卡片 + 展开详情（支持技能 emoji 图标）                              | 新增 |
| `src/renderer/views/MarketplaceView.vue`                                      | 市场页（三 Tab/搜索/标签/网格/详情）                                    | 新增 |
| `src/renderer/router/index.ts`                                                | 新增 `/marketplace` 路由                                                | 修改 |
| `src/renderer/components/settings/template/TemplateSettings.vue`                       | 加「进入模板市场」按钮 + emit                                           | 修改 |
| `src/renderer/components/SettingsView.vue`                                    | 监听关闭事件 + 跳转市场路由                                             | 修改 |
| `src/shared/i18n/locales/zhCN.ts` / `enUS.ts`                                 | 新增 `SETTINGS.MARKETPLACE.*` 与入口文案、技能 Tab 文案                 | 修改 |

测试文件：

| 文件                                                 | 内容                                              |
| ---------------------------------------------------- | ------------------------------------------------- |
| `tests/unit/shared/resource-path.test.ts`            | 新增：`resourceIdFromPath` / `resourcePathFromId` |
| `tests/unit/main/template-installed.service.test.ts` | 新增：三类清单读写/快照/清理                      |
| `tests/unit/main/workspace-init.test.ts`             | 新增（或并入现有）：首启复制过滤通用模板          |
| `tests/unit/main/resource-sync.service.test.ts`      | 修改：三类选择性同步用例                          |
| `tests/unit/main/template-market.service.test.ts`    | 新增：三类目录/安装/卸载/离线                     |
| `tests/unit/main/template.api.test.ts`               | 修改：市场 API 用例                               |
| `tests/unit/renderer/template-store.test.ts`         | 新增：市场 store 动作                             |
| `tests/unit/renderer/marketplace-filter.test.ts`     | 新增：筛选纯函数                                  |

---

## 五、任务分解

### Task 1: 共享类型与路径工具

**Files:**

- Modify: `src/shared/types/template.types.ts`
- Create: `src/shared/utils/resource.ts`
- Test: `tests/unit/shared/resource-path.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/shared/resource-path.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import {
  resourceIdFromPath,
  resourcePathFromId,
} from "@/shared/utils/resource";

describe("resourceIdFromPath", () => {
  it("解析 slash 路径", () => {
    expect(resourceIdFromPath("slash/article.json", "slash")).toBe("article");
  });
  it("解析 page 路径", () => {
    expect(resourceIdFromPath("page/page-prd.json", "page")).toBe("page-prd");
  });
  it("解析 skill 路径（去 .skill.json）", () => {
    expect(resourceIdFromPath("skills/polish.skill.json", "skill")).toBe(
      "polish",
    );
  });
});

describe("resourcePathFromId", () => {
  it("模板反推路径", () => {
    expect(resourcePathFromId("slash", "todo")).toBe("slash/todo.json");
    expect(resourcePathFromId("page", "page-prd")).toBe("page/page-prd.json");
  });
  it("技能反推路径", () => {
    expect(resourcePathFromId("skill", "polish")).toBe(
      "skills/polish.skill.json",
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/shared/resource-path.test.ts`
Expected: FAIL，`@/shared/utils/resource` 不存在。

- [ ] **Step 3: 实现共享工具**

创建 `src/shared/utils/resource.ts`：

```ts
import { RESOURCE_TYPE } from "@/shared/enums/resource.enums";

/** 从 manifest 条目路径解析资源 id：
 *  "slash/article.json" → "article"
 *  "page/page-prd.json" → "page-prd"
 *  "skills/polish.skill.json" → "polish"
 */
export function resourceIdFromPath(entryPath: string, type: string): string {
  let base = entryPath.split("/").pop() ?? entryPath;
  if (base.endsWith(".json")) base = base.slice(0, -".json".length);
  if (type === RESOURCE_TYPE.SKILL && base.endsWith(".skill")) {
    base = base.slice(0, -".skill".length);
  }
  return base;
}

/** 由类型与 id 反推 manifest 相对路径（安装/卸载用） */
export function resourcePathFromId(type: string, id: string): string {
  return type === RESOURCE_TYPE.SKILL
    ? `skills/${id}.skill.json`
    : `${type}/${id}.json`;
}
```

- [ ] **Step 4: 添加共享类型**

修改 `src/shared/types/template.types.ts`：导入处追加 `ResourceType`：

```ts
import type { ResourceType } from "@/shared/enums/resource.enums";
```

在文件末尾追加：

```ts
/** 已安装资源清单（<workspace>/resources/installed.json），键为资源类型，值为 id 列表 */
export type InstalledResourceList = Partial<Record<ResourceType, string[]>>;

/** 模板市场条目（远程 manifest 元数据 + 文件内容 + 本地安装状态合并，三类资源通用） */
export interface MarketplaceItem {
  id: string;
  type: ResourceType; // slash | page | skill
  /** 远程最新版本 */
  version: string;
  title: LocalizedText;
  description: LocalizedText;
  /** 模板为图标名；技能为 emoji 字符串 */
  icon: string;
  tags: LocalizedText[];
  /** 预览内容：模板为 markdown，技能为 promptTemplate */
  preview: LocalizedText;
  /** 适用职业（仅命令/页面模板；技能为空数组） */
  profession: Profession[];
  /** 本地是否已安装（本地存在对应资源文件） */
  installed: boolean;
  /** 本地已安装版本（未安装为空串） */
  installedVersion: string;
  /** 是否有可用更新（已安装且本地版本 < 远程版本） */
  updateAvailable: boolean;
}

/** 模板市场目录（一次拉取的结果） */
export interface MarketplaceCatalog {
  items: MarketplaceItem[];
  /** 远程 manifest 是否拉取成功（false = 离线降级，仅本地已安装数据） */
  offline: boolean;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/shared/resource-path.test.ts`
Expected: PASS（5 个用例）

- [ ] **Step 6: 提交**

```bash
git add src/shared/utils/resource.ts src/shared/types/template.types.ts tests/unit/shared/resource-path.test.ts
git commit -m "feat: 新增模板市场共享类型与资源路径解析工具"
```

---

### Task 2: 已安装清单服务（主进程，三类）

**Files:**

- Create: `src/main/core/services/template-installed.service.ts`
- Test: `tests/unit/main/template-installed.service.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/main/template-installed.service.test.ts`：

```ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/main/utils/logger", () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}));
const mockGetWorkspace = vi.hoisted(() => vi.fn(() => "/tmp/wrisp-test-ws"));
vi.mock("@/main/core/services/config.service", () => ({
  configService: { getValue: mockGetWorkspace },
}));
const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));
vi.mock("fs", () => ({
  __esModule: true,
  default: mockFs,
  existsSync: mockFs.existsSync,
  mkdirSync: mockFs.mkdirSync,
  readFileSync: mockFs.readFileSync,
  writeFileSync: mockFs.writeFileSync,
  unlinkSync: mockFs.unlinkSync,
}));

import { installedTemplateService } from "@/main/core/services/template-installed.service";
import type { RemoteManifest } from "@/shared/types/resource.types";

const remote: RemoteManifest = {
  version: "1.0.0",
  updatedAt: "2026-09-08T00:00:00Z",
  files: [
    { type: "slash", path: "slash/todo.json", version: "1.0.0", sha256: "h1" },
    {
      type: "page",
      path: "page/page-prd.json",
      version: "1.0.0",
      sha256: "h2",
    },
    {
      type: "skill",
      path: "skills/polish.skill.json",
      version: "1.0.0",
      sha256: "h3",
    },
  ],
};

describe("TemplateInstalledService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue("{}");
  });

  it("文件缺失时 load 返回空清单（三类）", () => {
    expect(installedTemplateService.load()).toEqual({
      slash: [],
      page: [],
      skill: [],
    });
  });
  it("loadWithSnapshot 文件缺失时按本地已存在文件快照并落盘", () => {
    // todo.json 与 polish.skill.json 本地存在（打包的通用模板 + 技能），page-prd.json 不存在（职业模板未打包）
    mockFs.existsSync.mockImplementation(
      (p: string) =>
        p.endsWith("slash/todo.json") || p.endsWith("skills/polish.skill.json"),
    );
    const list = installedTemplateService.loadWithSnapshot(remote);
    expect(list).toEqual({ slash: ["todo"], page: [], skill: ["polish"] });
    expect(mockFs.writeFileSync).toHaveBeenCalled();
  });
  it("loadWithSnapshot 在文件存在时读取文件", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ slash: ["todo"], page: [], skill: [] }),
    );
    const list = installedTemplateService.loadWithSnapshot(remote);
    expect(list.slash).toEqual(["todo"]);
    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });
  it("save 落盘", () => {
    installedTemplateService.save({ slash: ["a"], page: [], skill: [] });
    expect(mockFs.writeFileSync).toHaveBeenCalled();
  });
  it("prune 移除已不在远程清单中的 id", () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ slash: ["todo", "ghost"], page: [], skill: ["polish"] }),
    );
    installedTemplateService.prune(remote);
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('"slash": [\n    "todo"'),
      "utf-8",
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/main/template-installed.service.test.ts`
Expected: FAIL，服务不存在。

- [ ] **Step 3: 实现服务**

创建 `src/main/core/services/template-installed.service.ts`：

```ts
import fs from "fs";
import path from "path";
import { configService } from "@/main/core/services/config.service";
import { RESOURCES_DIR } from "@/main/constants/folder.constants";
import {
  isResourceType,
  RESOURCE_TYPES,
  type ResourceType,
} from "@/shared/enums/resource.enums";
import type { InstalledResourceList } from "@/shared/types/template.types";
import type { RemoteManifest } from "@/shared/types/resource.types";
import {
  resourceIdFromPath,
  resourcePathFromId,
} from "@/shared/utils/resource";
import { Logger } from "@/main/utils/logger";

const EMPTY: InstalledResourceList = {
  slash: [],
  page: [],
  skill: [],
};

class TemplateInstalledService {
  private static instance: TemplateInstalledService | null = null;
  private constructor() {}
  public static getInstance(): TemplateInstalledService {
    if (!TemplateInstalledService.instance) {
      TemplateInstalledService.instance = new TemplateInstalledService();
    }
    return TemplateInstalledService.instance;
  }

  private workspacePath(): string {
    const ws = (globalThis as Record<string, unknown>)
      .__WRISP_WORKSPACE_PATH__ as string | undefined;
    if (ws && ws.trim() !== "") return ws;
    return configService.getValue<string>("workspace") || "";
  }

  private filePath(): string {
    return path.join(this.workspacePath(), RESOURCES_DIR, "installed.json");
  }

  private resourcePath(type: string, id: string): string {
    return path.join(
      this.workspacePath(),
      RESOURCES_DIR,
      resourcePathFromId(type, id),
    );
  }

  /** 读取已安装清单；文件缺失返回空清单 */
  public load(): InstalledResourceList {
    try {
      const p = this.filePath();
      if (!fs.existsSync(p)) return { ...EMPTY };
      const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as Record<
        string,
        unknown
      >;
      const list: InstalledResourceList = {};
      for (const [key, value] of Object.entries(raw)) {
        if (isResourceType(key) && Array.isArray(value)) {
          list[key] = value.filter((v): v is string => typeof v === "string");
        }
      }
      for (const type of RESOURCE_TYPES) list[type] ??= [];
      return list;
    } catch (err) {
      Logger.warn("读取已安装清单失败", { error: String(err) });
      return { ...EMPTY };
    }
  }

  /**
   * 首次同步快照：installed.json 不存在时，把「本地已存在的资源文件」快照为已安装并落盘。
   * 打包只含通用模板 + 全部技能 → 职业模板默认未安装；老用户升级时本地已有文件不会丢失。
   */
  public loadWithSnapshot(remote: RemoteManifest): InstalledResourceList {
    if (!fs.existsSync(this.filePath())) {
      const list = this.snapshotFromLocal(remote);
      this.save(list);
      return list;
    }
    return this.load();
  }

  private snapshotFromLocal(remote: RemoteManifest): InstalledResourceList {
    const list: InstalledResourceList = {};
    for (const type of RESOURCE_TYPES) {
      list[type] = remote.files
        .filter((e) => e.type === type)
        .map((e) => resourceIdFromPath(e.path, e.type))
        .filter((id) => fs.existsSync(this.resourcePath(type, id)));
    }
    return list;
  }

  /** 清理已不在远程 manifest 中的 id（资源被上游下架） */
  public prune(remote: RemoteManifest): void {
    const list = this.load();
    const known = new Set(
      remote.files
        .filter((e) => isResourceType(e.type))
        .map((e) => resourceIdFromPath(e.path, e.type)),
    );
    let changed = false;
    for (const type of RESOURCE_TYPES) {
      const before = list[type] ?? [];
      list[type] = before.filter((id) => known.has(id));
      if (list[type].length !== before.length) changed = true;
    }
    if (changed) this.save(list);
  }

  public save(list: InstalledResourceList): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath()), { recursive: true });
      fs.writeFileSync(this.filePath(), JSON.stringify(list, null, 2), "utf-8");
    } catch (err) {
      Logger.error("保存已安装清单失败", { error: String(err) });
    }
  }
}

export const installedTemplateService = TemplateInstalledService.getInstance();
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/main/template-installed.service.test.ts`
Expected: PASS（5 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/main/core/services/template-installed.service.ts tests/unit/main/template-installed.service.test.ts
git commit -m "feat: 新增已安装资源清单服务（slash/page/skill）"
```

---

### Task 3: 打包过滤（仅通用模板）

**Files:**

- Modify: `vite.config.mts`
- Modify: `src/main/core/services/base/workspace-init.service.ts`
- Test: `tests/unit/main/workspace-init.test.ts`（新增）

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/main/workspace-init.test.ts`：

```ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/main/utils/logger", () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}));
const mockGetWorkspace = vi.hoisted(() => vi.fn(() => "/tmp/wrisp-test-ws"));
vi.mock("@/main/core/services/config.service", () => ({
  configService: { getValue: mockGetWorkspace },
}));
vi.mock("electron", () => ({ app: { getAppPath: vi.fn(() => "/app") } }));

const files: Record<string, string> = {
  "/app/resources/manifest.json": JSON.stringify({ version: "1.0.0" }),
  "/app/resources/slash/todo.json": JSON.stringify({
    id: "todo",
    profession: ["general"],
  }),
  "/app/resources/slash/article.json": JSON.stringify({
    id: "article",
    profession: ["writer"],
  }),
  "/app/resources/skills/polish.skill.json": JSON.stringify({
    id: "polish",
    name: { zh: "润色", en: "Polish" },
  }),
};
const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn((p: string) =>
    Object.prototype.hasOwnProperty.call(files, p),
  ),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(() => []),
  readFileSync: vi.fn((p: string) => files[p]),
  copyFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));
vi.mock("fs", () => ({
  __esModule: true,
  default: mockFs,
  existsSync: mockFs.existsSync,
  mkdirSync: mockFs.mkdirSync,
  readdirSync: mockFs.readdirSync,
  readFileSync: mockFs.readFileSync,
  copyFileSync: mockFs.copyFileSync,
  writeFileSync: mockFs.writeFileSync,
}));

import WorkspaceInitService from "@/main/core/services/base/workspace-init.service";

describe("WorkspaceInitService 首启复制过滤", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 走 dev 分支，使 sourceDir = path.resolve(app.getAppPath(), "resources") = /app/resources
    process.env.VITE_DEV_SERVER_URL = "http://localhost:5173";
  });
  afterEach(() => {
    delete process.env.VITE_DEV_SERVER_URL;
  });

  it("ensureWorkspace 复制时跳过职业模板（writer）", async () => {
    // 顶层目录：manifest.json、slash/、page/、skills/
    mockFs.readdirSync.mockImplementation((p: string) => {
      if (p === "/app/resources") return ["manifest.json", "slash", "skills"];
      if (p === "/app/resources/slash") return ["todo.json", "article.json"];
      if (p === "/app/resources/skills") return ["polish.skill.json"];
      return [];
    });
    await WorkspaceInitService.getInstance().ensureWorkspace();
    // 通用模板 todo 被复制
    expect(mockFs.copyFileSync).toHaveBeenCalledWith(
      "/app/resources/slash/todo.json",
      expect.stringContaining("slash/todo.json"),
    );
    // 职业模板 article 不被复制
    const calls = mockFs.copyFileSync.mock.calls.map((c: string[]) => c[0]);
    expect(calls).not.toContain("/app/resources/slash/article.json");
    // 技能与 manifest 全量复制
    expect(calls).toContain("/app/resources/skills/polish.skill.json");
    expect(calls).toContain("/app/resources/manifest.json");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/main/workspace-init.test.ts`
Expected: FAIL（article.json 当前会被复制）。

- [ ] **Step 3: 实现首启复制过滤**

修改 `src/main/core/services/base/workspace-init.service.ts`：

1. 新增导入：

```ts
import { RESOURCE_TYPE } from "@/shared/enums/resource.enums";
```

2. `ensureResourcesCopied` 调用处传入过滤谓词（第 101 行）：

```ts
this.copyDirectory(sourceDir, targetDir, this.isBundledResource);
```

3. `copyDirectory` 支持谓词（第 108~119 行替换）：

```ts
private copyDirectory(
  src: string,
  dest: string,
  relPath = "",
  filter?: (srcPath: string, relPath: string) => boolean,
): void {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    const entryRel = relPath ? `${relPath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      this.copyDirectory(srcPath, destPath, entryRel, filter);
    } else {
      if (filter && !filter(srcPath, entryRel)) continue;
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 仅打包通用模板：slash/page 下 profession 含 general（或缺失/为空）的文件才复制；
 * skills/schemas/manifest.json 全量复制。
 */
private isBundledResource(srcPath: string, relPath: string): boolean {
  const type = relPath.split("/")[0];
  if (type !== RESOURCE_TYPE.SLASH && type !== RESOURCE_TYPE.PAGE) return true;
  if (!relPath.endsWith(".json")) return false;
  try {
    const parsed = JSON.parse(fs.readFileSync(srcPath, "utf-8")) as { profession?: unknown };
    const profession = Array.isArray(parsed.profession) ? parsed.profession : [];
    return profession.length === 0 || profession.includes("general");
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: 实现构建产物过滤**

修改 `vite.config.mts` 的 `copyResources()`（第 41~55 行替换），使其复制时同样跳过非通用模板：

```ts
/** 仅打包通用模板：slash/page 下 profession 含 general（或缺失/为空）的文件；skills/schemas/manifest 全量 */
function isBundledResourceFile(src: string): boolean {
  const rel = path.relative(
    path.resolve(import.meta.dirname, "resources"),
    src,
  );
  const type = rel.split(path.sep)[0];
  if (type !== "slash" && type !== "page") return true;
  if (!src.endsWith(".json")) return false;
  try {
    const parsed = JSON.parse(fs.readFileSync(src, "utf-8")) as {
      profession?: unknown;
    };
    const profession = Array.isArray(parsed.profession)
      ? parsed.profession
      : [];
    return profession.length === 0 || profession.includes("general");
  } catch {
    return false;
  }
}

function copyResources() {
  const srcPath = path.resolve(import.meta.dirname, "resources");
  const destPath = path.resolve(import.meta.dirname, "dist-electron/resources");

  if (!fs.existsSync(srcPath)) return;
  if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });

  const files = fs.readdirSync(srcPath);
  files.forEach((file) => {
    const src = path.join(srcPath, file);
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      copyDirFiltered(src, path.join(destPath, file), isBundledResourceFile);
    } else {
      copyRecursive(src, path.join(destPath, file));
    }
  });
}

/** 递归复制并按谓词过滤文件 */
function copyDirFiltered(
  src: string,
  dest: string,
  filter: (src: string) => boolean,
) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const s = path.join(src, entry);
    const d = path.join(dest, entry);
    if (fs.statSync(s).isDirectory()) {
      copyDirFiltered(s, d, filter);
    } else if (filter(s)) {
      copyRecursive(s, d);
    }
  }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/main/workspace-init.test.ts`
Expected: PASS（1 个用例）。

- [ ] **Step 6: 验证构建产物**

Run: `pnpm exec vite build`（仅验证 `dist-electron/resources` 内容）
Expected: `dist-electron/resources/slash/` 只含 `brainstorm.json`、`daily-review.json`、`todo.json`；`page/` 只含 `page-reading-notes.json`、`page-weekly-report.json`；`skills/` 11 个全量；`manifest.json` 存在。

- [ ] **Step 7: 提交**

```bash
git add vite.config.mts src/main/core/services/base/workspace-init.service.ts tests/unit/main/workspace-init.test.ts
git commit -m "feat: 打包与首启复制仅包含通用模板，职业模板改由市场安装"
```

---

### Task 4: 选择性同步改造（三类统一）

**Files:**

- Modify: `src/main/core/services/resource-sync.service.ts`
- Test: `tests/unit/main/resource-sync.service.test.ts`（修改）

- [ ] **Step 1: 写失败测试**

在 `tests/unit/main/resource-sync.service.test.ts` 的 `describe` 内新增用例（沿用现有 mock：`mockFs.existsSync` 默认 false，`mockGetWorkspace` 返回 `/tmp/wrisp-test-ws`）：

```ts
it("选择性同步：slash/page/skill 均按已安装清单过滤", async () => {
  const remote: RemoteManifest = {
    version: "1.0.0",
    updatedAt: "2026-09-08T00:00:00Z",
    files: [
      {
        type: "skill",
        path: "skills/polish.skill.json",
        version: "1.0.0",
        sha256: "s1",
      },
      {
        type: "skill",
        path: "skills/grammar.skill.json",
        version: "1.0.0",
        sha256: "s2",
      },
      {
        type: "slash",
        path: "slash/todo.json",
        version: "1.0.0",
        sha256: "h1",
      },
      {
        type: "slash",
        path: "slash/article.json",
        version: "1.0.0",
        sha256: "h2",
      },
    ],
  };
  // installed.json 已存在：slash 装 todo、skill 装 polish；article 与 grammar 未安装
  mockFs.existsSync.mockImplementation((p: string) =>
    p.endsWith("installed.json"),
  );
  mockFs.readFileSync.mockReturnValue(
    JSON.stringify({ slash: ["todo"], page: [], skill: ["polish"] }),
  );
  mockFetchText
    .mockResolvedValueOnce({ ok: true, text: "manifest" })
    .mockResolvedValueOnce({ ok: true, text: "p" }) // polish
    .mockResolvedValueOnce({ ok: true, text: "t" }); // todo
  mockParse.mockReturnValueOnce(remote);
  mockCompare.mockReturnValueOnce({
    toAdd: remote.files,
    toUpdate: [],
    toRemove: [],
  });
  mockHash.mockReturnValueOnce("s1").mockReturnValueOnce("h1");
  const r = await resourceSyncService.checkAndSync();
  expect(r.success).toBe(true);
  expect(r.added).toEqual(["skills/polish.skill.json", "slash/todo.json"]);
  expect(r.added).not.toContain("skills/grammar.skill.json");
  expect(r.added).not.toContain("slash/article.json");
});

it("首次同步：按本地已存在文件快照（通用模板 + 技能），职业模板不下载", async () => {
  const remote: RemoteManifest = {
    version: "1.0.0",
    updatedAt: "",
    files: [
      {
        type: "slash",
        path: "slash/todo.json",
        version: "1.0.0",
        sha256: "h1",
      },
      {
        type: "slash",
        path: "slash/article.json",
        version: "1.0.0",
        sha256: "h2",
      },
      {
        type: "skill",
        path: "skills/polish.skill.json",
        version: "1.0.0",
        sha256: "s1",
      },
    ],
  };
  // installed.json 缺失；本地仅存在打包的通用模板与技能文件
  mockFs.existsSync.mockImplementation(
    (p: string) =>
      p.endsWith("slash/todo.json") || p.endsWith("skills/polish.skill.json"),
  );
  mockFetchText
    .mockResolvedValueOnce({ ok: true, text: "manifest" })
    .mockResolvedValueOnce({ ok: true, text: "t" })
    .mockResolvedValueOnce({ ok: true, text: "p" });
  mockParse.mockReturnValueOnce(remote);
  mockCompare.mockReturnValueOnce({
    toAdd: remote.files,
    toUpdate: [],
    toRemove: [],
  });
  mockHash.mockReturnValueOnce("h1").mockReturnValueOnce("s1");
  const r = await resourceSyncService.checkAndSync();
  expect(r.success).toBe(true);
  expect(r.added).toEqual(["slash/todo.json", "skills/polish.skill.json"]);
  expect(r.added).not.toContain("slash/article.json");
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/main/resource-sync.service.test.ts`
Expected: 新用例 FAIL（当前逻辑仍下载未安装项 / 不区分技能）。

- [ ] **Step 3: 改造同步逻辑**

修改 `src/main/core/services/resource-sync.service.ts`：

1. 新增导入（替换原第 10 行附近的资源类型导入）：

```ts
import { isResourceType, RESOURCE_TYPES } from "@/shared/enums/resource.enums";
import { resourceIdFromPath } from "@/shared/utils/resource";
import { installedTemplateService } from "@/main/core/services/template-installed.service";
```

2. `checkAndSync()` 在 `parseManifest` 成功后、`compareManifests` 前插入（原「全部 skill 自动同步」逻辑替换为三类统一过滤）：

```ts
// 首次同步：installed.json 缺失时按本地已存在文件快照为已安装，并清理已下架 id
const installed = installedTemplateService.loadWithSnapshot(remote);
installedTemplateService.prune(remote);

// 期望同步集合：三类资源均只同步已安装的条目
const desired = new Set<string>();
for (const entry of remote.files) {
  if (!isResourceType(entry.type)) continue;
  const id = resourceIdFromPath(entry.path, entry.type);
  if ((installed[entry.type] ?? []).includes(id)) {
    desired.add(entry.path);
  }
}
```

3. 下载循环改为只遍历期望集合内的条目：

```ts
for (const entry of [...diff.toAdd, ...diff.toUpdate].filter((e) => desired.has(e.path))) {
```

其余逻辑（hash 校验、写文件、toRemove 清理、saveLocalManifest、broadcast）保持不变。若原文件顶部有 `RESOURCE_TYPES`/`isResourceType` 之外不再使用的资源类型导入，一并清理（`pnpm lint` 会兜底校验未使用导入）。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/main/resource-sync.service.test.ts`
Expected: 全部 PASS（原有用例同步更新 mock 后通过 + 新增 2 个）。原「全量下载成功」用例改为依赖快照语义：mock `existsSync` 对模板/技能文件返回 true、对 installed.json 返回 false，断言不变（下载本地已有文件对应的条目）。

- [ ] **Step 5: 提交**

```bash
git add src/main/core/services/resource-sync.service.ts tests/unit/main/resource-sync.service.test.ts
git commit -m "feat: 资源同步改为三类选择性安装（slash/page/skill）"
```

---

### Task 5: 模板市场服务（主进程，三类）

**Files:**

- Create: `src/main/core/services/template-market.service.ts`
- Test: `tests/unit/main/template-market.service.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/main/template-market.service.test.ts`：

```ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/main/utils/logger", () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}));
vi.mock("electron", () => ({
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
}));
const mockGetWorkspace = vi.hoisted(() => vi.fn(() => "/tmp/wrisp-test-ws"));
vi.mock("@/main/core/services/config.service", () => ({
  configService: { getValue: mockGetWorkspace },
}));
const mockFetchText = vi.hoisted(() => vi.fn());
vi.mock("@/main/core/services/resource-http.client", () => ({
  resourceHttpClient: { fetchText: mockFetchText },
}));
const mockParse = vi.hoisted(() => vi.fn());
const mockHash = vi.hoisted(() => vi.fn(() => "h"));
vi.mock("@/main/core/services/resource-manifest", () => ({
  parseManifest: mockParse,
  computeFileHash: mockHash,
  compareManifests: vi.fn(() => ({ toAdd: [], toUpdate: [], toRemove: [] })),
}));
const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));
vi.mock("fs", () => ({
  __esModule: true,
  default: mockFs,
  existsSync: mockFs.existsSync,
  mkdirSync: mockFs.mkdirSync,
  readFileSync: mockFs.readFileSync,
  writeFileSync: mockFs.writeFileSync,
  unlinkSync: mockFs.unlinkSync,
}));

import { templateMarketService } from "@/main/core/services/template-market.service";
import type { RemoteManifest } from "@/shared/types/resource.types";

const remote: RemoteManifest = {
  version: "1.0.0",
  updatedAt: "2026-09-08T00:00:00Z",
  files: [
    { type: "slash", path: "slash/todo.json", version: "1.0.0", sha256: "h1" },
    {
      type: "slash",
      path: "slash/article.json",
      version: "1.1.0",
      sha256: "h2",
    },
    {
      type: "skill",
      path: "skills/polish.skill.json",
      version: "1.0.0",
      sha256: "h3",
    },
  ],
};

const localTodo = JSON.stringify({
  id: "todo",
  version: "1.0.0",
  title: { zh: "待办清单", en: "Todo List" },
  description: { zh: "插入待办清单框架", en: "Insert todo list skeleton" },
  icon: "task_alt",
  markdown: { zh: "## 待办", en: "## Todos" },
  profession: ["general"],
  tags: [{ zh: "计划", en: "planning" }],
  enabled: true,
});

describe("TemplateMarketService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    mockFetchText.mockResolvedValue({ ok: true, text: "manifest" });
    mockParse.mockReturnValue(remote);
  });

  it("模板目录：已安装带版本，远程较新则 updateAvailable", async () => {
    mockFs.existsSync.mockImplementation(
      (p: string) =>
        p.endsWith("installed.json") || p.endsWith("slash/todo.json"),
    );
    mockFs.readFileSync.mockImplementation((p: string) =>
      p.endsWith("installed.json")
        ? JSON.stringify({ slash: ["todo"], page: [], skill: [] })
        : localTodo,
    );
    const cat = await templateMarketService.getCatalog("slash");
    expect(cat.offline).toBe(false);
    expect(cat.items).toHaveLength(2);
    const todo = cat.items.find((i) => i.id === "todo")!;
    expect(todo.installed).toBe(true);
    expect(todo.installedVersion).toBe("1.0.0");
    expect(todo.preview.zh).toContain("待办");
    const article = cat.items.find((i) => i.id === "article")!;
    expect(article.installed).toBe(false);
    expect(article.updateAvailable).toBe(false);
  });

  it("技能目录：name→title、promptTemplate→preview、emoji 图标、无职业", async () => {
    mockFs.existsSync.mockImplementation(
      (p: string) =>
        p.endsWith("installed.json") || p.endsWith("skills/polish.skill.json"),
    );
    mockFs.readFileSync.mockImplementation((p: string) =>
      p.endsWith("installed.json")
        ? JSON.stringify({ slash: [], page: [], skill: ["polish"] })
        : JSON.stringify({
            id: "polish",
            version: "1.0.0",
            name: { zh: "润色", en: "Polish" },
            description: { zh: "优化文本表达", en: "Refine wording" },
            icon: "✨",
            promptTemplate: {
              zh: "请润色：{{text}}",
              en: "Please polish: {{text}}",
            },
            tags: [{ zh: "润色", en: "polish" }],
          }),
    );
    const cat = await templateMarketService.getCatalog("skill");
    const polish = cat.items.find((i) => i.id === "polish")!;
    expect(polish.title.zh).toBe("润色");
    expect(polish.icon).toBe("✨");
    expect(polish.profession).toEqual([]);
    expect(polish.preview.en).toContain("polish");
    expect(polish.installed).toBe(true);
  });

  it("离线降级：远程 manifest 拉取失败时用本地清单，仅返回本地已知条目", async () => {
    mockFetchText.mockResolvedValueOnce({ ok: false, error: "net" });
    mockFs.existsSync.mockImplementation(
      (p: string) =>
        p.endsWith("manifest.json") || p.endsWith("slash/todo.json"),
    );
    mockFs.readFileSync.mockImplementation((p: string) =>
      p.endsWith("manifest.json") ? JSON.stringify(remote) : localTodo,
    );
    const cat = await templateMarketService.getCatalog("slash");
    expect(cat.offline).toBe(true);
    expect(cat.items.every((i) => i.installed)).toBe(true);
  });

  it("安装：下载 + hash 校验 + 写入文件 + 更新清单", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ slash: [], page: [], skill: [] }),
    );
    mockFetchText.mockResolvedValue({ ok: true, text: "article-content" });
    mockHash.mockReturnValue("h2");
    const item = await templateMarketService.install("slash", "article");
    expect(item.installed).toBe(true);
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("article-content"),
      "utf-8",
    );
  });

  it("卸载：删除文件并更新清单", async () => {
    mockFs.existsSync.mockImplementation(
      (p: string) =>
        p.endsWith("installed.json") || p.endsWith("manifest.json"),
    );
    mockFs.readFileSync.mockImplementation((p: string) =>
      p.endsWith("installed.json")
        ? JSON.stringify({ slash: ["todo"], page: [], skill: [] })
        : JSON.stringify(remote),
    );
    mockFetchText.mockResolvedValue({ ok: false, error: "offline" });
    const item = await templateMarketService.uninstall("slash", "todo");
    expect(item.installed).toBe(false);
    expect(mockFs.unlinkSync).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/main/template-market.service.test.ts`
Expected: FAIL，服务不存在。

- [ ] **Step 3: 实现服务**

创建 `src/main/core/services/template-market.service.ts`：

```ts
import * as fs from "fs";
import * as path from "path";
import { BrowserWindow } from "electron";
import { configService } from "@/main/core/services/config.service";
import { resourceHttpClient } from "@/main/core/services/resource-http.client";
import {
  parseManifest,
  computeFileHash,
} from "@/main/core/services/resource-manifest";
import { installedTemplateService } from "@/main/core/services/template-installed.service";
import {
  RESOURCE_REPO,
  RESOURCE_CONFIG,
} from "@/main/constants/resource.constants";
import { RESOURCES_DIR } from "@/main/constants/folder.constants";
import {
  DEFAULT_TEMPLATE_ICON,
  isTemplateIconName,
} from "@/shared/enums/template.enums";
import {
  isResourceType,
  RESOURCE_TYPE,
  type ResourceType,
} from "@/shared/enums/resource.enums";
import { PROFESSION, type Profession } from "@/shared/enums";
import type {
  InstalledResourceList,
  MarketplaceCatalog,
  MarketplaceItem,
} from "@/shared/types/template.types";
import type {
  ManifestEntry,
  RemoteManifest,
} from "@/shared/types/resource.types";
import {
  resourceIdFromPath,
  resourcePathFromId,
} from "@/shared/utils/resource";
import { compareVersions, VersionComparison } from "@/main/utils/version";
import { Logger } from "@/main/utils/logger";

const CACHE_TTL_MS = 60_000;

/** 技能文件的最小结构（市场只消费其中部分字段） */
interface SkillFileMeta {
  id?: string;
  name?: { zh: string; en: string };
  description?: { zh: string; en: string };
  icon?: string;
  version?: string;
  tags?: { zh: string; en: string }[];
  promptTemplate?: { zh: string; en: string };
}

class TemplateMarketService {
  private static instance: TemplateMarketService | null = null;
  private cache = new Map<
    ResourceType,
    { ts: number; data: MarketplaceCatalog }
  >();
  private constructor() {}
  public static getInstance(): TemplateMarketService {
    if (!TemplateMarketService.instance) {
      TemplateMarketService.instance = new TemplateMarketService();
    }
    return TemplateMarketService.instance;
  }

  private workspacePath(): string {
    const ws = (globalThis as Record<string, unknown>)
      .__WRISP_WORKSPACE_PATH__ as string | undefined;
    if (ws && ws.trim() !== "") return ws;
    return configService.getValue<string>("workspace") || "";
  }
  private rawUrl(relPath: string): string {
    return `${RESOURCE_REPO.rawBase}/${RESOURCE_REPO.owner}/${RESOURCE_REPO.repo}/${RESOURCE_REPO.branch}/${relPath}`;
  }
  private localManifestPath(): string {
    return path.join(this.workspacePath(), RESOURCES_DIR, "manifest.json");
  }
  private resourceAbsPath(type: string, id: string): string {
    return path.join(
      this.workspacePath(),
      RESOURCES_DIR,
      resourcePathFromId(type, id),
    );
  }

  private async fetchRemoteManifest(): Promise<RemoteManifest | null> {
    const res = await resourceHttpClient.fetchText(
      this.rawUrl(RESOURCE_CONFIG.manifestPath),
    );
    if (!res.ok) {
      Logger.warn("拉取远程 manifest 失败", { error: res.error });
      return null;
    }
    return parseManifest(res.text);
  }

  private loadLocalManifest(): RemoteManifest | null {
    try {
      const p = this.localManifestPath();
      if (!fs.existsSync(p)) return null;
      return parseManifest(fs.readFileSync(p, "utf-8"));
    } catch (err) {
      Logger.warn("读取本地 manifest 失败", { error: String(err) });
      return null;
    }
  }

  /** 读取本地资源原始 JSON（不存在返回 null） */
  private readLocalRaw(
    type: string,
    id: string,
  ): Record<string, unknown> | null {
    try {
      const p = this.resourceAbsPath(type, id);
      if (!fs.existsSync(p)) return null;
      const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as Record<
        string,
        unknown
      >;
      return raw;
    } catch {
      return null;
    }
  }

  /** 下载远程资源原始 JSON 并做 sha256 校验 */
  private async fetchRemoteRaw(
    entry: ManifestEntry,
  ): Promise<Record<string, unknown> | null> {
    const url = this.rawUrl(`${RESOURCE_CONFIG.resourcesDir}/${entry.path}`);
    const res = await resourceHttpClient.fetchText(url);
    if (!res.ok) {
      Logger.warn("拉取资源文件失败", { path: entry.path, error: res.error });
      return null;
    }
    if (computeFileHash(res.text) !== entry.sha256) {
      Logger.warn("资源文件 hash 校验失败", { path: entry.path });
      return null;
    }
    try {
      return JSON.parse(res.text) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /** 按类型把原始 JSON 归一化为市场条目主体（不含安装状态） */
  private toItemBody(
    raw: Record<string, unknown>,
    id: string,
    type: ResourceType,
    version: string,
  ): Omit<
    MarketplaceItem,
    "installed" | "installedVersion" | "updateAvailable"
  > | null {
    if (type === RESOURCE_TYPE.SKILL) {
      const s = raw as SkillFileMeta;
      return {
        id,
        type,
        version,
        title: s.name ?? { zh: id, en: id },
        description: s.description ?? { zh: "", en: "" },
        icon:
          typeof s.icon === "string" && s.icon.trim() !== "" ? s.icon : "✨",
        tags: Array.isArray(s.tags) ? s.tags : [],
        preview: s.promptTemplate ?? { zh: "", en: "" },
        profession: [],
      };
    }
    return {
      id,
      type,
      version,
      title: (raw.title as MarketplaceItem["title"]) ?? { zh: id, en: id },
      description: (raw.description as MarketplaceItem["description"]) ?? {
        zh: "",
        en: "",
      },
      icon: isTemplateIconName(raw.icon) ? raw.icon : DEFAULT_TEMPLATE_ICON,
      tags: Array.isArray(raw.tags)
        ? (raw.tags as MarketplaceItem["tags"])
        : [],
      preview: (raw.markdown as MarketplaceItem["preview"]) ?? {
        zh: "",
        en: "",
      },
      profession: Array.isArray(raw.profession)
        ? (raw.profession as Profession[]).filter(
            (p) => typeof p === "string" && p !== PROFESSION.CUSTOM,
          )
        : [PROFESSION.GENERAL],
    };
  }

  private async buildEntry(
    entry: ManifestEntry,
    installed: InstalledResourceList,
    offline: boolean,
  ): Promise<MarketplaceItem | null> {
    if (!isResourceType(entry.type)) return null;
    const type = entry.type;
    const id = resourceIdFromPath(entry.path, type);
    const localRaw = this.readLocalRaw(type, id);
    const raw = localRaw ?? (offline ? null : await this.fetchRemoteRaw(entry));
    if (!raw) return null;
    const body = this.toItemBody(raw, id, type, entry.version);
    if (!body) return null;
    const installedVersion =
      typeof localRaw?.version === "string" ? localRaw.version : "";
    return {
      ...body,
      installed: localRaw !== null,
      installedVersion,
      updateAvailable:
        localRaw !== null &&
        compareVersions(installedVersion, entry.version) ===
          VersionComparison.OLDER,
    };
  }

  /** 拉取模板市场目录（主进程内存缓存 60s；force=true 强制刷新） */
  public async getCatalog(
    type: ResourceType,
    force = false,
  ): Promise<MarketplaceCatalog> {
    const cached = this.cache.get(type);
    if (!force && cached && Date.now() - cached.ts < CACHE_TTL_MS)
      return cached.data;

    const remote = await this.fetchRemoteManifest();
    const manifest = remote ?? this.loadLocalManifest();
    if (!manifest) return { items: [], offline: true };

    const installed = installedTemplateService.load();
    const entries = manifest.files.filter((e) => e.type === type);
    const items = await Promise.all(
      entries.map((e) => this.buildEntry(e, installed, remote === null)),
    );
    const catalog: MarketplaceCatalog = {
      items: items.filter((e): e is MarketplaceItem => e !== null),
      offline: remote === null,
    };
    this.cache.set(type, { ts: Date.now(), data: catalog });
    return catalog;
  }

  /** 安装：下载 + hash 校验 + 写入文件 + 加入已安装清单 */
  public async install(
    type: ResourceType,
    id: string,
  ): Promise<MarketplaceItem> {
    const manifest =
      (await this.fetchRemoteManifest()) ?? this.loadLocalManifest();
    const entry = manifest?.files.find(
      (e) => e.type === type && resourceIdFromPath(e.path, e.type) === id,
    );
    if (!entry) throw new Error("资源不存在于远程清单");

    const url = this.rawUrl(`${RESOURCE_CONFIG.resourcesDir}/${entry.path}`);
    const res = await resourceHttpClient.fetchText(url);
    if (!res.ok) throw new Error(`下载资源失败: ${res.error}`);
    if (computeFileHash(res.text) !== entry.sha256)
      throw new Error("资源文件 hash 校验失败");

    const abs = this.resourceAbsPath(type, id);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, res.text, "utf-8");

    const installed = installedTemplateService.load();
    installed[type] = [...new Set([...(installed[type] ?? []), id])];
    installedTemplateService.save(installed);

    this.cache.delete(type);
    this.broadcastUpdate([type]);
    const item = await this.buildEntry(entry, installed, false);
    if (!item) throw new Error("安装后资源读取失败");
    return item;
  }

  /** 卸载：从清单移除 + 删除本地文件 */
  public async uninstall(
    type: ResourceType,
    id: string,
  ): Promise<MarketplaceItem> {
    const installed = installedTemplateService.load();
    installed[type] = (installed[type] ?? []).filter((v) => v !== id);
    installedTemplateService.save(installed);

    const abs = this.resourceAbsPath(type, id);
    try {
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch (err) {
      Logger.warn("删除资源文件失败", { path: abs, error: String(err) });
    }

    this.cache.delete(type);
    this.broadcastUpdate([type]);
    const list = await this.getCatalog(type, true);
    const found = list.items.find((i) => i.id === id);
    if (found) return found;
    // 离线且本地文件已删除的兜底：返回最小条目
    const manifest = this.loadLocalManifest();
    const entry = manifest?.files.find(
      (e) => e.type === type && resourceIdFromPath(e.path, e.type) === id,
    );
    return {
      id,
      type,
      version: entry?.version ?? "",
      title: { zh: id, en: id },
      description: { zh: "", en: "" },
      icon: type === RESOURCE_TYPE.SKILL ? "✨" : DEFAULT_TEMPLATE_ICON,
      tags: [],
      preview: { zh: "", en: "" },
      profession: type === RESOURCE_TYPE.SKILL ? [] : [PROFESSION.GENERAL],
      installed: false,
      installedVersion: "",
      updateAvailable: false,
    };
  }

  private broadcastUpdate(types: ResourceType[]): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send("resource:updated", types);
    }
  }
}

export const templateMarketService = TemplateMarketService.getInstance();
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/main/template-market.service.test.ts`
Expected: PASS（5 个用例）。

- [ ] **Step 5: 提交**

```bash
git add src/main/core/services/template-market.service.ts tests/unit/main/template-market.service.test.ts
git commit -m "feat: 新增模板市场服务（三类资源目录/安装/卸载/更新检测）"
```

---

### Task 6: 市场 IPC 四层接口

**Files:**

- Modify: `src/main/preload/types/template.ts`
- Modify: `src/main/preload/modules/template.ts`
- Modify: `src/main/core/apis/template.api.ts`
- Modify: `src/main/ipcMain/template.ipc.ts`
- Test: `tests/unit/main/template.api.test.ts`（修改）

- [ ] **Step 1: 扩展 preload 类型**

修改 `src/main/preload/types/template.ts`，追加导入与接口成员：

```ts
import type { ResourceType } from "@/shared/enums/resource.enums";
import type {
  MarketplaceCatalog,
  MarketplaceItem,
} from "@/shared/types/template.types";

getMarketplace: (type: ResourceType, force?: boolean) =>
  Promise<ApiResponse<MarketplaceCatalog>>;
installMarketplace: (type: ResourceType, id: string) =>
  Promise<ApiResponse<MarketplaceItem>>;
uninstallMarketplace: (type: ResourceType, id: string) =>
  Promise<ApiResponse<MarketplaceItem>>;
```

- [ ] **Step 2: 扩展 preload 模块**

修改 `src/main/preload/modules/template.ts`：

```ts
getMarketplace: (type, force) =>
  ipcRenderer.invoke("template:getMarketplace", type, force),
installMarketplace: (type, id) =>
  ipcRenderer.invoke("template:installMarketplace", type, id),
uninstallMarketplace: (type, id) =>
  ipcRenderer.invoke("template:uninstallMarketplace", type, id),
```

- [ ] **Step 3: 扩展 core API**

修改 `src/main/core/apis/template.api.ts`，新增导入后追加：

```ts
import { templateMarketService } from "@/main/core/services/template-market.service";
import type {
  MarketplaceCatalog,
  MarketplaceItem,
} from "@/shared/types/template.types";

async function getMarketplace(
  type: ResourceType,
  force?: boolean,
): Promise<ApiResponse<MarketplaceCatalog>> {
  try {
    return response.success(
      await templateMarketService.getCatalog(type, force),
    );
  } catch (error) {
    Logger.error("获取模板市场失败", { error: String(error), type });
    return response.error(ErrorCode.TEMPLATE_GET_FAILED, error as Error);
  }
}

async function installMarketplace(
  type: ResourceType,
  id: string,
): Promise<ApiResponse<MarketplaceItem>> {
  try {
    return response.success(await templateMarketService.install(type, id));
  } catch (error) {
    Logger.error("安装资源失败", { error: String(error), type, id });
    return response.error(ErrorCode.TEMPLATE_SAVE_FAILED, error as Error);
  }
}

async function uninstallMarketplace(
  type: ResourceType,
  id: string,
): Promise<ApiResponse<MarketplaceItem>> {
  try {
    return response.success(await templateMarketService.uninstall(type, id));
  } catch (error) {
    Logger.error("卸载资源失败", { error: String(error), type, id });
    return response.error(ErrorCode.TEMPLATE_DELETE_FAILED, error as Error);
  }
}
```

更新该文件导出（末尾 `export` 语句）追加 `getMarketplace, installMarketplace, uninstallMarketplace`，并补 `ResourceType` 类型导入。

- [ ] **Step 4: 扩展 IPC handler**

修改 `src/main/ipcMain/template.ipc.ts`，导入三个新 API 并在 `registerTemplateHandlers` 内追加：

```ts
ipcMain.handle(
  "template:getMarketplace",
  async (
    _,
    type: ResourceType,
    force?: boolean,
  ): Promise<ApiResponse<MarketplaceCatalog>> => {
    return getMarketplace(type, force);
  },
);

ipcMain.handle(
  "template:installMarketplace",
  async (
    _,
    type: ResourceType,
    id: string,
  ): Promise<ApiResponse<MarketplaceItem>> => {
    return installMarketplace(type, id);
  },
);

ipcMain.handle(
  "template:uninstallMarketplace",
  async (
    _,
    type: ResourceType,
    id: string,
  ): Promise<ApiResponse<MarketplaceItem>> => {
    return uninstallMarketplace(type, id);
  },
);
```

- [ ] **Step 5: 运行类型检查**

Run: `pnpm typecheck`
Expected: 通过。

- [ ] **Step 6: 补充 API 测试**

在 `tests/unit/main/template.api.test.ts` 中：沿用现有 mock 模式，文件顶部追加 market service mock（仿照现有 `templateService` 的 `vi.hoisted` 写法）：

```ts
// ── Mock templateMarketService ──
const mockMarketService = vi.hoisted(() => ({
  getCatalog: vi.fn(() => ({ items: [], offline: true })),
  install: vi.fn(() => ({
    id: "todo",
    type: "slash",
    version: "1.0.0",
    title: { zh: "待办", en: "Todo" },
    description: { zh: "", en: "" },
    icon: "task_alt",
    tags: [],
    preview: { zh: "", en: "" },
    profession: ["general"],
    installed: true,
    installedVersion: "1.0.0",
    updateAvailable: false,
  })),
  uninstall: vi.fn(() => ({
    id: "todo",
    type: "slash",
    version: "1.0.0",
    title: { zh: "待办", en: "Todo" },
    description: { zh: "", en: "" },
    icon: "task_alt",
    tags: [],
    preview: { zh: "", en: "" },
    profession: ["general"],
    installed: false,
    installedVersion: "",
    updateAvailable: false,
  })),
}));

vi.mock("@/main/core/services/template-market.service", () => ({
  templateMarketService: mockMarketService,
  default: vi.fn(() => mockMarketService),
}));
```

在 describe 内新增用例（`beforeEach` 的 `vi.clearAllMocks()` 会清空 mock 返回值，需在用例内重新设置）：

```ts
it("getMarketplace 返回目录", async () => {
  mockMarketService.getCatalog.mockReturnValue({ items: [], offline: true });
  const res = await getMarketplace("slash", false);
  expect(res.success).toBe(true);
  expect(res.data).toEqual({ items: [], offline: true });
});
it("installMarketplace 失败返回错误码", async () => {
  mockMarketService.install.mockRejectedValue(new Error("404"));
  const res = await installMarketplace("slash", "todo");
  expect(res.success).toBe(false);
});
```

并同步更新该文件底部 `import { ... } from "@/main/core/apis/template.api"`，追加 `getMarketplace, installMarketplace, uninstallMarketplace`。

Run: `pnpm exec vitest run tests/unit/main/template.api.test.ts`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add src/main/preload/types/template.ts src/main/preload/modules/template.ts src/main/core/apis/template.api.ts src/main/ipcMain/template.ipc.ts tests/unit/main/template.api.test.ts
git commit -m "feat: 新增模板市场 IPC 四层接口"
```

---

### Task 7: 渲染层模板 store 扩展（三类）

**Files:**

- Modify: `src/renderer/store/template.store.ts`
- Test: `tests/unit/renderer/template-store.test.ts`（新增）

- [ ] **Step 1: 写失败测试**

创建 `tests/unit/renderer/template-store.test.ts`：

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useTemplateStore } from "@/renderer/store/template.store";
import { RESOURCE_TYPE } from "@/shared/enums/resource.enums";
import type {
  MarketplaceCatalog,
  MarketplaceItem,
} from "@/shared/types/template.types";

const item: MarketplaceItem = {
  id: "todo",
  type: RESOURCE_TYPE.SLASH,
  version: "1.0.0",
  title: { zh: "待办", en: "Todo" },
  description: { zh: "", en: "" },
  icon: "task_alt",
  tags: [],
  preview: { zh: "", en: "" },
  profession: ["general"],
  installed: false,
  installedVersion: "",
  updateAvailable: false,
};
const catalog: MarketplaceCatalog = { items: [item], offline: false };

const mockApi = {
  getMarketplace: vi.fn(async () => ({ success: true, data: catalog })),
  installMarketplace: vi.fn(async () => ({
    success: true,
    data: { ...item, installed: true, installedVersion: "1.0.0" },
  })),
  uninstallMarketplace: vi.fn(async () => ({
    success: true,
    data: { ...item, installed: false },
  })),
  getFile: vi.fn(async () => ({
    success: true,
    data: { customTemplates: [], disabledTemplateIds: [] },
  })),
  getBuiltIn: vi.fn(async () => ({ success: true, data: [] })),
};

(globalThis as Record<string, unknown>).window = {
  electronAPI: { template: mockApi },
} as unknown as Window;

describe("template store 市场", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });
  it("fetchMarketplace 填充目录", async () => {
    const store = useTemplateStore();
    await store.fetchMarketplace(RESOURCE_TYPE.SLASH);
    expect(store.marketplace[RESOURCE_TYPE.SLASH]?.items).toHaveLength(1);
  });
  it("installMarketplace 更新条目并刷新内置", async () => {
    const store = useTemplateStore();
    await store.fetchMarketplace(RESOURCE_TYPE.SLASH);
    const ok = await store.installMarketplace(RESOURCE_TYPE.SLASH, "todo");
    expect(ok).toBe(true);
    const updated = store.marketplace[RESOURCE_TYPE.SLASH]!.items[0];
    expect(updated.installed).toBe(true);
    expect(mockApi.getBuiltIn).toHaveBeenCalledWith(RESOURCE_TYPE.SLASH);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/renderer/template-store.test.ts`
Expected: FAIL（`store.marketplace` 不存在）。

- [ ] **Step 3: 扩展 store**

修改 `src/renderer/store/template.store.ts`：

1. 导入追加：

```ts
import type { ResourceType } from "@/shared/enums/resource.enums";
import { RESOURCE_TYPE } from "@/shared/enums/resource.enums";
import type {
  MarketplaceCatalog,
  MarketplaceItem,
} from "@/shared/types/template.types";
```

2. 新增状态与动作（在 `invalidate` 之后插入）：

```ts
/** 各类型的市场目录（按类型懒加载，slash/page/skill） */
const marketplace = ref<
  Partial<Record<ResourceType, MarketplaceCatalog | null>>
>({
  [RESOURCE_TYPE.SLASH]: null,
  [RESOURCE_TYPE.PAGE]: null,
  [RESOURCE_TYPE.SKILL]: null,
});

/** 拉取指定类型的模板市场目录（force=true 强制绕过主进程缓存） */
async function fetchMarketplace(
  type: ResourceType,
  force = false,
): Promise<void> {
  const res = await window.electronAPI.template.getMarketplace(type, force);
  if (res.success && res.data) {
    marketplace.value[type] = res.data as MarketplaceCatalog;
  }
}

function applyMarketplaceItem(
  type: ResourceType,
  entry: MarketplaceItem,
): void {
  const cat = marketplace.value[type];
  if (!cat) return;
  const i = cat.items.findIndex((e) => e.id === entry.id);
  if (i >= 0) cat.items[i] = entry;
}

/** 安装资源：更新市场条目，并使内置缓存失效后重新加载（设置页/Slash 菜单即时生效） */
async function installMarketplace(
  type: ResourceType,
  id: string,
): Promise<boolean> {
  const res = await window.electronAPI.template.installMarketplace(type, id);
  if (res.success && res.data) {
    applyMarketplaceItem(type, res.data as MarketplaceItem);
    builtins.value[type] = null;
    await fetch(type);
    return true;
  }
  return false;
}

/** 卸载资源：更新市场条目，并使内置缓存失效后重新加载 */
async function uninstallMarketplace(
  type: ResourceType,
  id: string,
): Promise<boolean> {
  const res = await window.electronAPI.template.uninstallMarketplace(type, id);
  if (res.success && res.data) {
    applyMarketplaceItem(type, res.data as MarketplaceItem);
    builtins.value[type] = null;
    await fetch(type);
    return true;
  }
  return false;
}

/** 资源更新后清空市场缓存 */
function invalidateMarketplace(types: ResourceType[]): void {
  for (const type of types) marketplace.value[type] = null;
}
```

3. `return` 对象追加：

```ts
return {
  files,
  builtins,
  marketplace,
  isLoaded,
  fetch,
  saveCustom,
  removeCustom,
  setEnabled,
  invalidate,
  invalidateMarketplace,
  allTemplates,
  fetchMarketplace,
  installMarketplace,
  uninstallMarketplace,
};
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/renderer/template-store.test.ts`
Expected: PASS（2 个用例）。

- [ ] **Step 5: 提交**

```bash
git add src/renderer/store/template.store.ts tests/unit/renderer/template-store.test.ts
git commit -m "feat: 模板 store 新增三类市场目录与安装/卸载动作"
```

---

### Task 8: 设置-模板管理页重新设计 + 市场入口

**Files:**

- Modify: `src/renderer/components/settings/template/TemplateSettings.vue`
- Modify: `src/renderer/components/SettingsView.vue`

- [ ] **Step 1: TemplateSettings 增加市场入口按钮与事件**

修改 `src/renderer/components/settings/template/TemplateSettings.vue`：

1. 头部按钮区（`n-flex align="center" :size="8"` 内，放在「新建」下拉之前）插入：

```html
<n-button type="primary" @click="enterMarketplace">
  <template #icon
    ><n-icon><StorefrontOutlined /></n-icon
  ></template>
  {{ t("SETTINGS.TEMPLATE_SETTINGS.ENTER_MARKETPLACE") }}
</n-button>
```

2. script 部分：新增导入与 emit：

```ts
import { StorefrontOutlined } from "@vicons/material";

const emit = defineEmits<{
  /** 请求关闭设置弹窗并跳转模板市场 */
  (e: "enterMarketplace"): void;
}>();

function enterMarketplace() {
  emit("enterMarketplace");
}
```

- [ ] **Step 2: SettingsView 联动关闭弹窗并跳转**

修改 `src/renderer/components/SettingsView.vue`：

1. 动态组件追加监听：

```html
<component
  :is="currentComponent"
  :config="config"
  @enterMarketplace="enterMarketplace"
/>
```

2. script 新增 `useRouter` 与处理函数：

```ts
import { useRouter } from "vue-router";
const router = useRouter();

function enterMarketplace() {
  showModal.value = false;
  router.push("/marketplace");
}
```

- [ ] **Step 3: 运行类型检查与 lint**

Run: `pnpm typecheck && pnpm lint`
Expected: 通过。

- [ ] **Step 4: 提交**

```bash
git add src/renderer/components/settings/template/TemplateSettings.vue src/renderer/components/SettingsView.vue
git commit -m "feat: 设置-模板管理页新增模板市场入口"
```

---

### Task 9: 模板市场页面（路由 + 视图 + 卡片 + 筛选）

**Files:**

- Create: `src/renderer/components/marketplace/marketplace-filter.ts`
- Test: `tests/unit/renderer/marketplace-filter.test.ts`
- Create: `src/renderer/components/marketplace/TemplateCard.vue`
- Create: `src/renderer/views/MarketplaceView.vue`
- Modify: `src/renderer/router/index.ts`

- [ ] **Step 1: 写筛选纯函数测试**

创建 `tests/unit/renderer/marketplace-filter.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { filterMarketplace } from "@/renderer/components/marketplace/marketplace-filter";
import { RESOURCE_TYPE } from "@/shared/enums/resource.enums";
import type { MarketplaceItem } from "@/shared/types/template.types";

const base = (over: Partial<MarketplaceItem>): MarketplaceItem => ({
  id: "t",
  type: RESOURCE_TYPE.SLASH,
  version: "1.0.0",
  title: { zh: "文章大纲", en: "Article Outline" },
  description: {
    zh: "插入文章大纲框架",
    en: "Insert article outline skeleton",
  },
  icon: "edit",
  tags: [
    { zh: "写作", en: "writing" },
    { zh: "大纲", en: "outline" },
  ],
  preview: { zh: "", en: "" },
  profession: ["writer"],
  installed: false,
  installedVersion: "",
  updateAvailable: false,
  ...over,
});

const list = [
  base({
    id: "a",
    title: { zh: "文章大纲", en: "Article Outline" },
    tags: [{ zh: "写作", en: "writing" }],
  }),
  base({
    id: "b",
    title: { zh: "待办清单", en: "Todo List" },
    tags: [{ zh: "计划", en: "planning" }],
  }),
];

describe("filterMarketplace", () => {
  it("关键词匹配当前语言标题/描述（中文）", () => {
    expect(
      filterMarketplace(list, { keyword: "大纲", tag: "", locale: "zhCN" }).map(
        (t) => t.id,
      ),
    ).toEqual(["a"]);
  });
  it("关键词匹配英文标题（英文环境）", () => {
    expect(
      filterMarketplace(list, {
        keyword: "outline",
        tag: "",
        locale: "enUS",
      }).map((t) => t.id),
    ).toEqual(["a"]);
  });
  it("标签筛选（按当前语言标签）", () => {
    expect(
      filterMarketplace(list, { keyword: "", tag: "写作", locale: "zhCN" }).map(
        (t) => t.id,
      ),
    ).toEqual(["a"]);
    expect(
      filterMarketplace(list, {
        keyword: "",
        tag: "planning",
        locale: "enUS",
      }).map((t) => t.id),
    ).toEqual(["b"]);
  });
  it("关键词 + 标签组合", () => {
    expect(
      filterMarketplace(list, { keyword: "清单", tag: "写作", locale: "zhCN" }),
    ).toHaveLength(0);
  });
  it("空条件返回全量", () => {
    expect(
      filterMarketplace(list, { keyword: "", tag: "", locale: "zhCN" }),
    ).toHaveLength(2);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm exec vitest run tests/unit/renderer/marketplace-filter.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现筛选纯函数**

创建 `src/renderer/components/marketplace/marketplace-filter.ts`：

```ts
import { LOCALE } from "@/shared/enums";
import type { MarketplaceItem } from "@/shared/types/template.types";

export interface MarketplaceFilter {
  keyword: string;
  /** 当前语言解析后的标签（'' = 全部） */
  tag: string;
  locale: string;
}

/**
 * 市场列表筛选：按当前语言匹配标题/描述关键词，并按当前语言标签过滤。
 * 纯函数，便于单测。
 */
export function filterMarketplace(
  list: MarketplaceItem[],
  f: MarketplaceFilter,
): MarketplaceItem[] {
  const useEn = f.locale === LOCALE.EN;
  const kw = f.keyword.trim().toLowerCase();
  return list.filter((item) => {
    if (f.tag) {
      const hasTag = item.tags.some((tg) => (useEn ? tg.en : tg.zh) === f.tag);
      if (!hasTag) return false;
    }
    if (!kw) return true;
    const title = (useEn ? item.title.en : item.title.zh).toLowerCase();
    const desc = (
      useEn ? item.description.en : item.description.zh
    ).toLowerCase();
    return title.includes(kw) || desc.includes(kw);
  });
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm exec vitest run tests/unit/renderer/marketplace-filter.test.ts`
Expected: PASS（5 个用例）。

- [ ] **Step 5: 实现资源卡片组件**

创建 `src/renderer/components/marketplace/TemplateCard.vue`：

```vue
<template>
  <div
    class="template-card"
    :class="{ expanded }"
    @click="emit('toggle', item.id)"
  >
    <n-flex justify="space-between" align="center" class="card-top">
      <n-tag size="small" :bordered="false" :type="statusType">{{
        statusText
      }}</n-tag>
      <n-button
        size="small"
        :type="actionType"
        :disabled="item.installed && !item.updateAvailable"
        @click.stop="emit('install', item)"
      >
        {{ actionText }}
      </n-button>
    </n-flex>

    <n-flex align="center" :size="10" class="card-body">
      <div class="card-icon">
        <component :is="iconComponent" class="card-icon-svg" />
      </div>
      <div class="card-meta">
        <div class="card-title">{{ title }}</div>
        <div class="card-desc">{{ description }}</div>
      </div>
    </n-flex>

    <n-flex align="center" :size="6" :wrap="true" class="card-footer">
      <span class="card-version">v{{ item.version }}</span>
      <n-tag
        v-for="tag in tags"
        :key="tag"
        size="small"
        :bordered="false"
        type="primary"
        >{{ tag }}</n-tag
      >
    </n-flex>

    <n-collapse-transition>
      <div v-show="expanded" class="card-detail" @click.stop>
        <div class="detail-row">
          <span class="detail-label">{{
            t("SETTINGS.MARKETPLACE.VERSION_CURRENT")
          }}</span>
          <span class="detail-value">{{ item.installedVersion || "—" }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">{{
            t("SETTINGS.MARKETPLACE.VERSION_LATEST")
          }}</span>
          <span class="detail-value">v{{ item.version }}</span>
        </div>
        <div v-if="isTemplate" class="detail-row">
          <span class="detail-label">{{
            t("SETTINGS.TEMPLATE_SETTINGS.PROFESSION")
          }}</span>
          <n-flex :size="4" align="center" class="detail-value" :wrap="true">
            <n-tag
              v-for="p in item.profession"
              :key="p"
              size="small"
              :bordered="false"
            >
              {{ t(`SETTINGS.PROFESSION.OPTION_${p.toUpperCase()}`) }}
            </n-tag>
          </n-flex>
        </div>
        <div class="detail-row detail-preview">
          <span class="detail-label">{{
            t("SETTINGS.MARKETPLACE.PREVIEW")
          }}</span>
          <pre class="markdown-preview">{{ preview }}</pre>
        </div>
        <n-flex justify="end" :size="8" class="detail-actions">
          <n-popconfirm
            v-if="item.installed"
            @positive-click="emit('uninstall', item)"
            :positive-text="t('SETTINGS.MARKETPLACE.UNINSTALL_CONFIRM_OK')"
            :negative-text="t('SETTINGS.MARKETPLACE.UNINSTALL_CONFIRM_CANCEL')"
          >
            <template #trigger>
              <n-button size="small" type="error" quaternary>
                {{ t("SETTINGS.MARKETPLACE.UNINSTALL") }}
              </n-button>
            </template>
            {{ t("SETTINGS.MARKETPLACE.UNINSTALL_CONFIRM") }}
          </n-popconfirm>
          <n-button size="small" type="primary" @click="emit('install', item)">
            {{
              item.installed
                ? t("SETTINGS.MARKETPLACE.UPDATE")
                : t("SETTINGS.MARKETPLACE.INSTALL")
            }}
          </n-button>
        </n-flex>
      </div>
    </n-collapse-transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useConfig } from "@/renderer/composables/useConfig";
import { resolveTemplateIcon } from "@/renderer/components/editor/slash/commands/template-icons";
import { RESOURCE_TYPE } from "@/shared/enums/resource.enums";
import { LOCALE } from "@/shared/enums";
import type { MarketplaceItem } from "@/shared/types/template.types";

const props = defineProps<{
  item: MarketplaceItem;
  expanded: boolean;
}>();

const emit = defineEmits<{
  (e: "toggle", id: string): void;
  (e: "install", item: MarketplaceItem): void;
  (e: "uninstall", item: MarketplaceItem): void;
}>();

const { t } = useI18n();
const { locale } = useConfig();
const useEn = computed(() => locale.value === LOCALE.EN);

const isTemplate = computed(() => props.item.type !== RESOURCE_TYPE.SKILL);
const title = computed(() =>
  useEn.value ? props.item.title.en : props.item.title.zh,
);
const description = computed(() =>
  useEn.value ? props.item.description.en : props.item.description.zh,
);
const preview = computed(() =>
  useEn.value ? props.item.preview.en : props.item.preview.zh,
);
const tags = computed(() =>
  props.item.tags.map((tag) => (useEn.value ? tag.en : tag.zh)),
);

/** 模板显示图标组件；技能显示 emoji 文本 */
const iconComponent = computed(() => {
  if (props.item.type === RESOURCE_TYPE.SKILL) {
    return { render: () => props.item.icon }; // 简单 emoji 渲染
  }
  return resolveTemplateIcon(props.item.icon);
});

const statusText = computed(() => {
  const { installed, updateAvailable } = props.item;
  if (installed && updateAvailable)
    return t("SETTINGS.MARKETPLACE.UPDATE_AVAILABLE");
  if (installed) return t("SETTINGS.MARKETPLACE.INSTALLED");
  return t("SETTINGS.MARKETPLACE.NOT_INSTALLED");
});
const statusType = computed(() => {
  const { installed, updateAvailable } = props.item;
  if (installed && updateAvailable) return "warning" as const;
  if (installed) return "info" as const;
  return "default" as const;
});
const actionText = computed(() => {
  const { installed, updateAvailable } = props.item;
  if (installed && updateAvailable) return t("SETTINGS.MARKETPLACE.UPDATE");
  if (installed) return t("SETTINGS.MARKETPLACE.INSTALLED");
  return t("SETTINGS.MARKETPLACE.INSTALL");
});
const actionType = computed(() =>
  props.item.installed ? ("default" as const) : ("primary" as const),
);
</script>

<style scoped lang="scss">
.template-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-secondary);
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;

  &:hover {
    border-color: var(--primary-color, #18a058);
  }
  &.expanded {
    border-color: var(--primary-color, #18a058);
  }
}
.card-top {
  gap: 8px;
}
.card-body {
  min-width: 0;
}
.card-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--bg-color, #fff);
}
.card-icon-svg {
  width: 22px;
  height: 22px;
}
.card-meta {
  min-width: 0;
}
.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
  line-height: 1.4;
}
.card-desc {
  font-size: 12px;
  color: var(--text-third);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-footer {
  gap: 6px;
}
.card-version {
  font-size: 12px;
  color: var(--text-third);
  font-family: var(--font-mono, monospace);
}
.card-detail {
  border-top: 1px solid var(--border-color);
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 12px;
  line-height: 1.5;
}
.detail-label {
  flex-shrink: 0;
  width: 64px;
  color: var(--text-third);
}
.detail-value {
  min-width: 0;
  word-break: break-all;
}
.detail-preview {
  flex-direction: column;
  gap: 4px;
}
.markdown-preview {
  width: 100%;
  max-height: 200px;
  overflow: auto;
  margin: 0;
  padding: 10px;
  border-radius: 6px;
  background: var(--bg-color, #fff);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}
.detail-actions {
  margin-top: 4px;
}
</style>
```

- [ ] **Step 6: 实现市场页面（三类型 Tab）**

创建 `src/renderer/views/MarketplaceView.vue`：

```vue
<template>
  <n-flex vertical class="marketplace-view">
    <n-flex justify="space-between" align="center" class="market-header">
      <n-flex align="center" :size="10">
        <n-button
          quaternary
          circle
          size="small"
          :title="t('SETTINGS.MARKETPLACE.BACK')"
          @click="router.back()"
        >
          <n-icon><ArrowBackOutlined /></n-icon>
        </n-button>
        <div>
          <div class="title">{{ t("SETTINGS.MARKETPLACE.TITLE") }}</div>
          <div class="desc">{{ t("SETTINGS.MARKETPLACE.DESC") }}</div>
        </div>
      </n-flex>
      <n-flex align="center" :size="8">
        <n-alert
          v-if="offline"
          type="warning"
          :show-icon="false"
          class="offline-hint"
          :title="t('SETTINGS.MARKETPLACE.OFFLINE')"
        />
        <n-button :loading="loading" @click="refresh">
          <template #icon
            ><n-icon><RefreshOutlined /></n-icon
          ></template>
          {{ t("SETTINGS.MARKETPLACE.REFRESH") }}
        </n-button>
      </n-flex>
    </n-flex>

    <n-tabs v-model:value="activeType" type="line" size="small">
      <n-tab
        :name="RESOURCE_TYPE.SLASH"
        :tab="t('SETTINGS.TEMPLATE_SETTINGS.TYPE_SLASH')"
      />
      <n-tab
        :name="RESOURCE_TYPE.PAGE"
        :tab="t('SETTINGS.TEMPLATE_SETTINGS.TYPE_PAGE')"
      />
      <n-tab
        :name="RESOURCE_TYPE.SKILL"
        :tab="t('SETTINGS.MARKETPLACE.TYPE_SKILL')"
      />
    </n-tabs>

    <n-input
      v-model:value="keyword"
      :placeholder="t('SETTINGS.MARKETPLACE.SEARCH_PLACEHOLDER')"
      clearable
    >
      <template #prefix
        ><n-icon><SearchOutlined /></n-icon
      ></template>
    </n-input>

    <n-flex align="center" :size="6" :wrap="true" class="tag-filter">
      <n-button
        size="small"
        :type="selectedTag === '' ? 'primary' : 'default'"
        @click="selectedTag = ''"
      >
        {{ t("SETTINGS.MARKETPLACE.ALL") }}
      </n-button>
      <n-button
        v-for="tag in tagOptions"
        :key="tag"
        size="small"
        :type="selectedTag === tag ? 'primary' : 'default'"
        @click="selectedTag = tag"
      >
        {{ tag }}
      </n-button>
    </n-flex>

    <n-spin :show="loading" class="market-spin">
      <n-result
        v-if="loadFailed"
        status="error"
        :title="t('SETTINGS.MARKETPLACE.LOAD_FAILED')"
      >
        <template #footer>
          <n-button @click="refresh">{{
            t("SETTINGS.MARKETPLACE.RETRY")
          }}</n-button>
        </template>
      </n-result>
      <template v-else>
        <n-grid
          v-if="filtered.length > 0"
          responsive="screen"
          cols="1 s:1 m:2 l:3 xl:3"
          :x-gap="12"
          :y-gap="12"
        >
          <n-gi v-for="item in filtered" :key="item.id">
            <TemplateCard
              :item="item"
              :expanded="expandedId === item.id"
              @toggle="onToggle"
              @install="onInstall"
              @uninstall="onUninstall"
            />
          </n-gi>
        </n-grid>
        <n-empty
          v-else
          :description="t('SETTINGS.MARKETPLACE.NO_RESULTS')"
          class="market-empty"
        />
      </template>
    </n-spin>
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useMessage } from "naive-ui";
import {
  ArrowBackOutlined,
  RefreshOutlined,
  SearchOutlined,
} from "@vicons/material";
import TemplateCard from "@/renderer/components/marketplace/TemplateCard.vue";
import { filterMarketplace } from "@/renderer/components/marketplace/marketplace-filter";
import { useTemplateStore } from "@/renderer/store/template.store";
import { useConfig } from "@/renderer/composables/useConfig";
import {
  isResourceType,
  RESOURCE_TYPE,
  type ResourceType,
} from "@/shared/enums/resource.enums";
import { LOCALE } from "@/shared/enums";
import type { MarketplaceItem } from "@/shared/types/template.types";

const { t } = useI18n();
const router = useRouter();
const message = useMessage();
const { locale } = useConfig();
const store = useTemplateStore();

const activeType = ref<ResourceType>(RESOURCE_TYPE.SLASH);
const keyword = ref("");
const selectedTag = ref("");
const expandedId = ref<string | null>(null);
const loading = ref(false);
const loadFailed = ref(false);
const offline = ref(false);

const useEn = computed(() => locale.value === LOCALE.EN);
const catalog = computed<MarketplaceItem[]>(
  () => store.marketplace[activeType.value]?.items ?? [],
);

const tagOptions = computed<string[]>(() => {
  const seen = new Set<string>();
  for (const item of catalog.value) {
    for (const tag of item.tags) seen.add(useEn.value ? tag.en : tag.zh);
  }
  return [...seen];
});

const filtered = computed(() =>
  filterMarketplace(catalog.value, {
    keyword: keyword.value,
    tag: selectedTag.value,
    locale: locale.value,
  }),
);

async function load(force = false): Promise<void> {
  if (loading.value) return;
  loading.value = true;
  loadFailed.value = false;
  try {
    const res = await window.electronAPI.template.getMarketplace(
      activeType.value,
      force,
    );
    if (res.success && res.data) {
      store.marketplace[activeType.value] = res.data;
      offline.value = res.data.offline;
      if (expandedId.value) expandedId.value = null;
    } else {
      loadFailed.value = true;
    }
  } finally {
    loading.value = false;
  }
}

function refresh(): void {
  load(true);
}

function onToggle(id: string): void {
  expandedId.value = expandedId.value === id ? null : id;
}

async function onInstall(item: MarketplaceItem): Promise<void> {
  const ok = await store.installMarketplace(item.type, item.id);
  if (ok) message.success(t("SETTINGS.MARKETPLACE.INSTALLED_MSG"));
  else message.error(t("SETTINGS.MARKETPLACE.INSTALL_FAILED"));
}

async function onUninstall(item: MarketplaceItem): Promise<void> {
  const ok = await store.uninstallMarketplace(item.type, item.id);
  if (ok) message.success(t("SETTINGS.MARKETPLACE.UNINSTALLED_MSG"));
  else message.error(t("SETTINGS.MARKETPLACE.UNINSTALL_FAILED"));
}

let offUpdated: (() => void) | null = null;

onMounted(() => {
  if (!store.marketplace[activeType.value]) load();
  offUpdated = window.electronAPI.resource.onUpdated((changedTypes) => {
    const types = changedTypes.filter((t): t is ResourceType =>
      isResourceType(t),
    );
    if (types.length === 0) return;
    store.invalidate(types);
    store.invalidateMarketplace(types);
    if (types.includes(activeType.value)) {
      store.fetch(activeType.value);
      load(true);
    }
  });
});

onUnmounted(() => {
  offUpdated?.();
});
</script>

<style scoped lang="scss">
.marketplace-view {
  height: 100%;
  padding: 0 20px 20px;
  gap: 12px;
  overflow: hidden;
}
.market-header {
  flex-shrink: 0;
}
.title {
  font-size: 18px;
  font-weight: 600;
}
.desc {
  font-size: 12px;
  color: var(--text-third);
  margin-top: 2px;
}
.offline-hint {
  padding: 6px 12px;
  font-size: 12px;
}
.tag-filter {
  flex-shrink: 0;
}
.market-spin {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.market-empty {
  margin-top: 40px;
}
</style>
```

- [ ] **Step 7: 注册路由**

修改 `src/renderer/router/index.ts`，在 `children` 数组中追加：

```ts
{
  path: "marketplace",
  name: "Marketplace",
  component: () => import("../views/MarketplaceView.vue"),
},
```

- [ ] **Step 8: 运行类型检查、lint 与测试**

Run: `pnpm typecheck && pnpm lint && pnpm exec vitest run tests/unit/renderer/marketplace-filter.test.ts`
Expected: 全部通过。

- [ ] **Step 9: 提交**

```bash
git add src/renderer/components/marketplace src/renderer/views/MarketplaceView.vue src/renderer/router/index.ts tests/unit/renderer/marketplace-filter.test.ts
git commit -m "feat: 新增模板市场页面（三类 Tab/搜索/标签筛选/卡片/展开详情）"
```

---

### Task 10: i18n 文案

**Files:**

- Modify: `src/shared/i18n/locales/zhCN.ts`
- Modify: `src/shared/i18n/locales/enUS.ts`

- [ ] **Step 1: zhCN 新增文案**

在 `SETTINGS.TEMPLATE_SETTINGS` 内追加入口文案：

```ts
ENTER_MARKETPLACE: "进入模板市场",
```

在 `SETTINGS` 下新增 `MARKETPLACE` 分组：

```ts
MARKETPLACE: {
  TITLE: "模板市场",
  DESC: "浏览并安装官方提供的命令模板、页面模板与技能模板",
  TYPE_SKILL: "技能模板",
  SEARCH_PLACEHOLDER: "搜索名称或描述…",
  ALL: "全部",
  INSTALL: "安装",
  INSTALLED: "已安装",
  UPDATE: "更新",
  UNINSTALL: "卸载",
  UPDATE_AVAILABLE: "可更新",
  NOT_INSTALLED: "未安装",
  NO_RESULTS: "没有找到匹配的资源",
  LOAD_FAILED: "加载模板市场失败",
  OFFLINE: "当前处于离线状态，仅显示已安装的资源",
  RETRY: "重试",
  BACK: "返回",
  REFRESH: "刷新",
  VERSION_CURRENT: "当前版本",
  VERSION_LATEST: "最新版本",
  PREVIEW: "内容预览",
  UNINSTALL_CONFIRM: "卸载后该资源将从本地移除，确定卸载？",
  UNINSTALL_CONFIRM_OK: "卸载",
  UNINSTALL_CONFIRM_CANCEL: "取消",
  INSTALLED_MSG: "资源已安装",
  INSTALL_FAILED: "资源安装失败",
  UNINSTALLED_MSG: "资源已卸载",
  UNINSTALL_FAILED: "资源卸载失败",
},
```

- [ ] **Step 2: enUS 新增文案**

在 `SETTINGS.TEMPLATE_SETTINGS` 内追加：

```ts
ENTER_MARKETPLACE: "Open Marketplace",
```

在 `SETTINGS` 下新增：

```ts
MARKETPLACE: {
  TITLE: "Template Marketplace",
  DESC: "Browse and install official slash templates, page templates, and skills",
  TYPE_SKILL: "Skills",
  SEARCH_PLACEHOLDER: "Search by name or description…",
  ALL: "All",
  INSTALL: "Install",
  INSTALLED: "Installed",
  UPDATE: "Update",
  UNINSTALL: "Uninstall",
  UPDATE_AVAILABLE: "Update available",
  NOT_INSTALLED: "Not installed",
  NO_RESULTS: "No matching resources",
  LOAD_FAILED: "Failed to load the template marketplace",
  OFFLINE: "Offline — showing installed resources only",
  RETRY: "Retry",
  BACK: "Back",
  REFRESH: "Refresh",
  VERSION_CURRENT: "Current version",
  VERSION_LATEST: "Latest version",
  PREVIEW: "Preview",
  UNINSTALL_CONFIRM: "This resource will be removed locally. Uninstall it?",
  UNINSTALL_CONFIRM_OK: "Uninstall",
  UNINSTALL_CONFIRM_CANCEL: "Cancel",
  INSTALLED_MSG: "Resource installed",
  INSTALL_FAILED: "Failed to install resource",
  UNINSTALLED_MSG: "Resource uninstalled",
  UNINSTALL_FAILED: "Failed to uninstall resource",
},
```

- [ ] **Step 3: 运行类型检查**

Run: `pnpm typecheck`
Expected: 通过。

- [ ] **Step 4: 提交**

```bash
git add src/shared/i18n/locales/zhCN.ts src/shared/i18n/locales/enUS.ts
git commit -m "feat: 新增模板市场 i18n 中英文文案"
```

---

### Task 11: 回归验证

**Files:**

- 无新增

- [ ] **Step 1: 全量类型检查与 lint**

Run: `pnpm typecheck && pnpm lint`
Expected: 0 error / 0 warning。

- [ ] **Step 2: 全量单测**

Run: `pnpm test`
Expected: 全部 PASS。若 `tests/integration/**` 因 better-sqlite3 ABI 不匹配失败，先执行 `pnpm rebuild` 后再跑（已知历史问题，与本功能无关）。

- [ ] **Step 3: 验证打包产物仅含通用模板**

Run: `pnpm exec vite build`
Expected: `dist-electron/resources/slash/` 仅 `brainstorm.json` / `daily-review.json` / `todo.json`；`dist-electron/resources/page/` 仅 `page-reading-notes.json` / `page-weekly-report.json`；`skills/` 11 个；`manifest.json` 存在且完整。

- [ ] **Step 4: 手动验证（pnpm dev）**

1. 打开「设置 → 模板」：确认「进入模板市场」按钮存在，点击后设置弹窗关闭并跳转 `/marketplace`。
2. 市场页三个 Tab：命令模板 / 页面模板 / 技能模板；搜索、标签筛选生效；卡片展示名称/描述/版本/标签；语言切换（zhCN/enUS）后文案随之切换。
3. 职业模板（如「文章大纲」）初始为「未安装」；点「安装」→ 状态变「已安装」，Slash 菜单/新建页面弹窗中可见。
4. 技能 Tab：技能显示 emoji 图标、无职业行；展开详情显示 prompt 预览；安装/卸载后 Slash 命令菜单同步变化。
5. 已安装资源展开详情：显示当前/最新版本、适用职业（仅模板）、内容预览；「更新」升级；「卸载」弹确认后移除。
6. 断网刷新市场页 → 显示离线提示，仅列出已安装资源。
7. 设置页「检查模板更新」仍可执行，仅同步已安装的三类资源。
8. 首启（删除 workspace/resources 后启动）：仅通用模板 + 全部技能被复制；职业模板在市场显示「未安装」。

- [ ] **Step 5: 提交（如有遗留）**

```bash
git add -A
git commit -m "chore: 模板市场回归修复"
```

---

## 六、自检（Spec 覆盖核对）

| 需求                                  | 对应任务                                                |
| ------------------------------------- | ------------------------------------------------------- |
| 内置仅打包通用模板、职业不打包        | Task 3（`vite.config.mts` + `workspace-init` 双处过滤） |
| 市场按类型分别查看：命令/页面/技能    | Task 9（三 Tab）+ Task 5（三类目录）                    |
| 设置-模板管理重新设计：市场入口       | Task 8                                                  |
| 设置-模板管理重新设计：检查更新       | 保留原「检查模板更新」；Task 4 后语义为仅同步已安装资源 |
| 设置-模板管理重新设计：新建自定义模板 | 保留原「新建」下拉                                      |
| 设置-模板管理重新设计：已安装模板列表 | 保留数据表；选择性安装后 `getBuiltIn` 只返回本地已安装  |
| 模板市场独立布局页面                  | Task 9（新路由 `/marketplace` 全页）                    |
| 市场搜索                              | Task 9 `filterMarketplace`（按当前语言）                |
| 按标签快速筛选                        | Task 9 标签 chips + 过滤                                |
| 根据语言自动显示中英文                | Task 9/10 复用 `useConfig().locale`                     |
| 卡片含名称/描述/版本/标签             | Task 9 `TemplateCard.vue`                               |
| 点击模板展开详情                      | Task 9 卡片展开（版本/职业/预览/操作）                  |
| 选择性安装（用户确认）                | Task 2/4/5                                              |

**一致性核对**：`getCatalog(type, force)` / `install(type, id)` / `uninstall(type, id)` 在 Task 5/6/7 签名一致；`MarketplaceCatalog { items; offline }` 在 Task 1 定义、Task 5 构造、Task 6 透传、Task 7/9 消费一致；`resourceIdFromPath(path, type)` / `resourcePathFromId(type, id)` 在 Task 1 定义，Task 2/4/5 使用一致；IPC 通道 `template:getMarketplace` / `installMarketplace` / `uninstallMarketplace` 跨层一致。

## 七、风险与兼容性

1. **老用户升级**：`installed.json` 不存在 → 按「本地已存在文件」快照，老用户已有的职业模板/技能不丢失；此后新增的远程资源默认未安装。
2. **技能改为选择性安装**：行为变化——新技能不再自动出现，需在市场安装；已安装技能仍可被「检查模板更新」升级。若后续希望技能保持全量自动同步，可仅对 skill 类型放宽 desired 过滤（保留在 Task 4 改动点，一行调整）。
3. **离线**：市场页降级显示已安装资源；安装/卸载在离线时不可用（远程拉取失败报错提示）。
4. **GitHub 限流**：目录缓存 60s + 手动刷新才强制拉取，常规操作不会频繁请求。
5. **manifest 格式不变**：`resources/manifest.json` 仍为全量远程清单（打包产物也保留），不新增远程基础设施。
6. **Slash 菜单/新建页面弹窗/技能面板**：均基于本地 resources 目录读取，卸载后自动消失，无需额外改动。
7. **职业模板仍随仓库存在**：仓库 `resources/` 保留全部模板（市场数据源）；仅打包产物与首启种子过滤。
