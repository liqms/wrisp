# 远程模板同步设计文档

日期：2026-08-31
状态：已确认

## 目标

设计统一的远程模板同步机制，覆盖 slash 模板、作品（page）模板、skill 模板三类资源，后续可扩展其他类型。模板文件集中存放于项目根目录 `resources/`，提交到 GitHub 仓库；应用打包时自动包含最新版本，运行时启动检查 GitHub 是否有更新，有则自动同步到本地工作区。

## 设计决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| GitHub 数据源 | 仓库原始文件（raw URL） | 适合小 JSON 文件，无需发版即可更新 |
| 更新策略 | 全自动更新 | 模板为轻量资源，静默同步用户无感知 |
| 版本粒度 | 单文件版本 + sha256 hash | 精准检测变更，支持增量更新与回溯 |
| 仓库认证 | 公开仓库（无 token） | raw.githubusercontent.com 匿名访问，60 次/小时足够 |
| 内置模板迁移 | TS 硬编码 → JSON 文件 | 统一数据源，便于远程同步 |
| 存储位置 | 统一 `<workspace>/resources/` | 内置与远程同源，无需多层查找 |
| skill 子目录 | 去掉 `built-in/` 子层 | 统一来源后无需分类 |
| slash/page 文件粒度 | 每模板一个 JSON 文件 | 独立版本管理、增量更新 |

## 目录结构

### 开发时（提交 GitHub，远程同步源头）

```
resources/
├── manifest.json                         # 总清单（版本+hash索引）
├── slash/                                # 18 个模板文件
│   ├── prd-draft.json
│   ├── tech-design.json
│   ├── weekly-report.json
│   └── ...
├── page/                                 # 5 个模板文件
│   ├── prd.json
│   ├── tech-design.json
│   ├── weekly-report.json
│   ├── reading-notes.json
│   └── project-plan.json
└── skills/                               # 11 个 skill + 1 个 schema
    ├── translate.skill.json
    ├── tone.skill.json
    ├── sentiment.skill.json
    ├── rewrite.skill.json
    ├── summarize.skill.json
    ├── polish.skill.json
    ├── outline.skill.json
    ├── keywords.skill.json
    ├── grammar.skill.json
    ├── expand.skill.json
    ├── continue.skill.json
    └── skill.schema.json                 # Ajv 校验 schema（静态资源，不入 manifest）
```

### 打包时（vite.config.mts 复制到 dist-electron）

```
dist-electron/
└── resources/                            # 与 resources/ 结构一致
    ├── manifest.json
    ├── slash/...
    ├── page/...
    └── skills/...
```

`vite.config.mts` 新增 `copyResources()` 函数（参照现有 `copySchemas()` 模式），将 `resources/` 整体复制到 `dist-electron/resources/`，运行时通过 `__dirname` 解析路径。

### 运行时工作区

```
<workspace>/
├── resources/                            # 内置+远程同步的统一存储（可写）
│   ├── manifest.json                     # 本地版本快照
│   ├── slash/
│   │   ├── prd-draft.json
│   │   └── ...
│   ├── page/
│   │   ├── prd.json
│   │   └── ...
│   └── skills/
│       ├── translate.skill.json
│       └── ...
├── templates/                            # 仅用户自定义（不变）
│   ├── slash/templates.json
│   └── page/templates.json
├── skills/                               # 仅用户自定义 skill（不变）
│   └── custom/
│       └── <id>.skill.json
└── ...（其他现有目录 sqlite/、attachments/ 等）
```

## 数据结构

### manifest.json（总清单）

```json
{
  "version": "1.0.0",
  "updatedAt": "2026-08-31T10:00:00Z",
  "files": [
    {
      "type": "slash",
      "path": "slash/prd-draft.json",
      "version": "1.0.0",
      "sha256": "abc123..."
    },
    {
      "type": "page",
      "path": "page/prd.json",
      "version": "1.0.0",
      "sha256": "def456..."
    },
    {
      "type": "skill",
      "path": "skills/translate.skill.json",
      "version": "1.0.0",
      "sha256": "ghi789..."
    }
  ]
}
```

- `version`：manifest 整体版本（任意文件变更时递增）
- `files[].type`：`ResourceType` 枚举值（slash/page/skill，可扩展）
- `files[].path`：相对 `resources/` 的路径
- `files[].version`：单文件语义化版本
- `files[].sha256`：文件内容 SHA256 hash，用于变更检测
- `skill.schema.json` 不入 manifest（静态校验资源，随包发布不更新）

### 单个 slash/page 模板文件

`src/shared/types/template.types.ts` 新增：

```ts
interface TemplateResourceFile {
  id: string;                  // 唯一标识（与文件名一致，不含扩展名）
  version: string;             // 语义化版本 "1.0.0"
  title: LocalizedText;        // { zh, en }
  description: LocalizedText;
  icon: TemplateIconName;      // TEMPLATE_ICON_NAMES 枚举值
  markdown: LocalizedText;     // 中英双语正文
  profession: Profession[];    // 适用的职业列表（数组，支持多职业）
  tags: string[];              // 类型标签（用于筛选/分组）
  enabled: boolean;            // 默认启用
}
```

**profession 数组语义**：
- `[PROFESSION.GENERAL]` = 通用，所有职业可见
- `[PROFESSION.PM, PROFESSION.DEVELOPER]` = 仅产品经理和开发者可见
- `CUSTOM` 不出现在内置模板（仅用于用户自定义模板归类）

**tags 示例**：
- slash：`["heading"]`、`["list"]`、`["code"]`、`["table"]`、`["admonition"]`、`["math"]`、`["metric"]`、`["image"]`
- page：`["document", "prd"]`、`["report", "weekly"]`、`["note", "reading"]`、`["plan", "project"]`

### skill 文件

沿用现有 `SkillDefinition`（`src/shared/types/skill.types.ts`），不改动。文件名从 `<id>.skill.json` 改为路径 `skills/<id>.skill.json`（去掉 `built-in/` 子目录）。

## 同步流程

### 启动时检查（异步，不阻塞窗口创建）

```
1. 拉取远程 manifest
   GET https://raw.githubusercontent.com/{owner}/{repo}/{branch}/resources/manifest.json

2. 比对本地 manifest（<workspace>/resources/manifest.json）
   - 本地不存在 → 全量下载
   - 本地存在 → 逐文件比对 version + sha256

3. 下载变更文件
   对每个 version 不一致或 hash 不匹配的 entry：
   GET https://raw.githubusercontent.com/{owner}/{repo}/{branch}/resources/{path}

4. 写入工作区
   保存到 <workspace>/resources/{path}

5. 更新本地 manifest
   写入最新 manifest.json

6. 广播事件
   resource:updated（携带变更的 ResourceType 列表）

7. 失败处理
   任何步骤失败则静默终止，使用本地缓存，记日志；不影响应用启动
```

### 首次启动（工作区无 resources 目录）

```
1. workspace-init.service.ts 检测 <workspace>/resources/ 不存在
2. 从打包的 dist-electron/resources/ 整体复制到 <workspace>/resources/
3. 后续走远程同步流程（可能立即检查到 GitHub 有更新）
```

### 加载流程（统一两层）

```
内置+远程模板：<workspace>/resources/{type}/
用户自定义模板：<workspace>/templates/{type}/templates.json 或 <workspace>/skills/custom/
```

加载时合并优先级：
1. 内置（从 `<workspace>/resources/{type}/` 扫描）
2. 自定义（从用户自定义目录读取）
3. 黑名单过滤（`disabledTemplateIds` 屏蔽内置）
4. 同 id 时自定义覆盖内置（向后兼容用户修改）

## 核心组件

### 新增文件

| 组件 | 路径 | 职责 |
|---|---|---|
| 同步服务 | `src/main/core/services/resource-sync.service.ts` | 启动时检查、比对、下载、写入工作区 |
| Manifest 模型 | `src/main/core/services/resource-manifest.ts` | manifest 类型定义、解析、比对逻辑 |
| GitHub 客户端 | `src/main/core/services/resource-http.client.ts` | 封装 raw URL 下载 + 超时/重试 |
| 常量 | `src/main/constants/resource.constants.ts` | owner/repo/branch/rawBaseURL/超时/重试 |
| 共享类型 | `src/shared/types/resource.types.ts` | RemoteManifest / ManifestEntry / SyncStatus |
| 共享枚举 | `src/shared/enums/resource.enums.ts` | ResourceType = { SLASH, PAGE, SKILL }（可扩展） |
| IPC 处理器 | `src/main/ipcMain/resource.ipc.ts` | `resource:syncStatus`、`resource:syncNow`、`resource:updated` 广播 |
| Preload 模块 | `src/main/preload/modules/resource.ts` | 暴露 resource API 到 renderer |
| Preload 类型 | `src/main/preload/types/resource.ts` | 类型声明 |

### 常量定义

`src/main/constants/resource.constants.ts`：

```ts
export const RESOURCE_REPO = {
  owner: "liqms",
  repo: "wrisp",
  branch: "main",          // 远程同步的目标分支
  rawBase: "https://raw.githubusercontent.com"
} as const;

export const RESOURCE_CONFIG = {
  manifestPath: "resources/manifest.json",
  resourcesDir: "resources",
  requestTimeout: 15000,
  maxRetries: 2
} as const;
```

`src/main/constants/folder.constants.ts` 新增：

```ts
export const FOLDER_NAMES = {
  // ...现有常量
  resources: "resources",      // 工作区内 resources 目录名
} as const;
```

### IPC 通道

| 通道 | 方向 | 用途 |
|---|---|---|
| `resource:syncStatus` | renderer → main | 查询当前同步状态（最后同步时间、是否正在同步） |
| `resource:syncNow` | renderer → main | 手动触发同步（设置页"立即检查更新"按钮） |
| `resource:updated` | main → renderer（广播） | 同步完成后通知渲染层刷新缓存 |

## 对现有功能的影响与改动

### 1. Slash 模板系统

**当前**：
- 内置 18 条硬编码于 `src/renderer/components/editor/slash/commands/templates.ts` 的 `builtinTemplates`
- 自定义从 `<workspace>/templates/slash/templates.json` 加载
- 合并在 renderer 侧 `template-merge.ts` 完成

**改动**：
- **删除** `templates.ts` 中 `builtinTemplates` TS 字面量
- **新增** 18 个 JSON 文件到 `resources/slash/`（每模板一个，含中英双语、version、profession 数组、tags）
- `template.service.ts` 新增 `getBuiltInTemplates(type)` 方法：扫描 `<workspace>/resources/{type}/` 目录下所有 `*.json`，解析为 `TemplateResourceFile[]`，按当前 locale 解析双语
- `template.store.ts` 的 `fetch()` 调用新 IPC `template:getBuiltIn(type)` 获取内置，再与 custom 合并
- `mergeTemplates()` 调整：三源合并（内置 + 自定义 + 黑名单过滤），内置按当前 locale 解析双语
- `SlashMenu.vue` 的 `onMounted` 流程不变（仍调 `templateStore.fetch(SLASH)`）

### 2. 作品/Page 模板系统

**当前**：
- 内置 5 条硬编码于 `src/renderer/templates/builtin-page-templates.ts`
- 自定义从 `<workspace>/templates/page/templates.json` 加载

**改动**：
- **删除** `builtin-page-templates.ts` 硬编码
- **新增** 5 个 JSON 文件到 `resources/page/`（每模板一个）
- `template.service.ts` 的 `getBuiltInTemplates(type)` 同时服务 slash 和 page
- `template.store.ts` 的 `fetch()` 调用 `template:getBuiltIn(PAGE)` 获取内置
- `TemplateSettings.vue` 新增：
  - 来源标识（内置/自定义）
  - 版本号显示（内置模板显示 `version` 字段）
  - tags 筛选（按标签过滤模板列表）
  - profession 多选筛选（当前单选，改为支持"适用职业"多选筛选）

### 3. Skill 模板系统

**当前**：
- 内置 11 个 JSON 文件在 `resources/skills/built-in/`，首次启动复制到 `<skillsDir>/built-in/`
- 远程更新用 `skill.updater.ts` + `remoteUpdateUrl`（自定义服务器），下载到 `<skillsDir>/remote/`
- 加载扫描 built-in/custom/remote 三目录

**改动**：
- **移动** `resources/skills/built-in/*.skill.json` → `resources/skills/*.skill.json`（去掉 `built-in/` 子目录）
- `skill.manager.ts` 的 `loadSkills()` 调整：
  - 内置源改为扫描 `<workspace>/resources/skills/*.skill.json`
  - 不再扫描 `<skillsDir>/built-in/`（废弃该中间目录）
  - 仍扫描 `<skillsDir>/custom/` 用户自定义
- **废弃** `skill.updater.ts` 的 `remoteUpdateUrl` 机制与 `<skillsDir>/remote/` 目录（统一由 resource-sync 处理 skill 远程同步）
- `skill.manager.ts` 的 `syncBuiltInSkills` 逻辑移除（resource-sync 接管版本同步）
- `SkillSource` 枚举：
  - `built-in` → 保留（语义=打包内置+远程同步的统一来源）
  - `custom` → 不变
  - `remote` → **移除**（不再有独立的 remote 目录）
- Skill 的 `manifest.json`（V2 格式）与 resource 的 `manifest.json` 关系：resource manifest 管理文件级版本+hash，skill manifest 管理运行时状态（enabled/disabled/params），两者职责分离，不合并

**迁移兼容**：
- 现有用户工作区可能有 `<skillsDir>/built-in/` 目录（旧版本首次复制的）
- 升级后 `skill.manager.ts` 检测到旧 `<skillsDir>/built-in/` 存在时，标记为废弃目录（不再扫描加载）
- 新版本改为从 `<workspace>/resources/skills/` 加载
- 日志提示用户该目录已废弃（不主动删除，避免误删用户数据）

### 4. 工作区初始化

`src/main/core/services/base/workspace-init.service.ts` 的 `ensureWorkspace()` 新增：
- 创建 `<workspace>/resources/` 目录
- 检测该目录不存在时，从打包的 `dist-electron/resources/` 整体复制（首次启动场景）

### 5. 启动流程

`src/main/index.ts` 在 workspace 初始化完成后、窗口创建后异步触发：

```ts
// 异步触发，不阻塞窗口创建
resourceSyncService.checkAndSync().catch(err => logger.error('Resource sync failed', err));
```

### 6. 渲染层刷新

同步完成后主进程广播 `resource:updated` 事件（携带变更的 ResourceType 列表），渲染层：
- `template.store.ts` 监听后清空缓存并重新 `fetch()`
- skill store 监听后重新加载 skill 列表

### 7. 打包配置

`vite.config.mts` 新增 `copyResources()` 函数（参照 `copySchemas()`）：

```ts
function copyResources() {
  // 将 resources/ 复制到 dist-electron/resources/
}
```

在 `electron()` 插件配置的 `build.rollupOptions` 或 `vitePluginBuildConfig` 中调用。

## 测试策略

### 单元测试

- `resource-manifest.ts`：manifest 解析、版本比对、hash 计算
- `resource-http.client.ts`：mock fetch 响应，验证超时/重试/错误处理
- `resource-sync.service.ts`：mock HTTP + 文件系统，验证全量下载、增量更新、失败回退
- 路径解析：`<workspace>/resources/` 与 `dist-electron/resources/` 路径正确性

### 集成测试

- 端到端同步流程：mock GitHub 响应 → 检查 → 下载 → 写入 → 广播事件
- 首次启动场景：工作区无 resources → 从打包目录复制 → 远程检查
- 边界场景：
  - 网络失败：静默终止，使用本地缓存
  - manifest 损坏：JSON 解析失败时回退到本地
  - 单个文件下载失败：跳过该文件，继续其他文件
  - 本地目录不存在：自动创建

### 现有功能回归

- slash 模板加载：内置从 resources 加载、自定义仍从 templates 加载、合并逻辑正确
- page 模板加载：同上
- skill 加载：内置从 resources/skills 加载、自定义从 custom 加载、Ajv 校验仍生效
- skill 执行：L1/L2 执行流程不受影响

## 扩展性

`ResourceType` 枚举设计为可扩展，后续新增类型（如 prompt 模板、snippet 模板）只需：

1. 在 `resources/` 下新增子目录与 JSON 文件
2. `manifest.json` 添加对应 entry（type 为新枚举值）
3. 加载逻辑接入对应 store
4. `resource-sync.service.ts` 无需改动（按 manifest entry 通用处理）

## 实施步骤建议

1. **Phase 1：数据迁移**
   - 将 slash 18 条内置模板从 TS 字面量转为 `resources/slash/*.json`
   - 将 page 5 条内置模板从 TS 字面量转为 `resources/page/*.json`
   - 移动 `resources/skills/built-in/*` → `resources/skills/*`
   - 生成 `resources/manifest.json`（含所有文件的 version + sha256）

2. **Phase 2：打包与初始化**
   - `vite.config.mts` 新增 `copyResources()`
   - `folder.constants.ts` 新增 `resources` 常量
   - `workspace-init.service.ts` 新增首次复制逻辑

3. **Phase 3：加载逻辑改造**
   - `template.types.ts` 新增 `TemplateResourceFile` 类型
   - `template.service.ts` 新增 `getBuiltInTemplates(type)` 方法
   - `template.store.ts` 改用新 IPC 加载内置
   - `mergeTemplates()` 调整合并逻辑
   - `skill.manager.ts` 调整 `loadSkills()` 扫描路径

4. **Phase 4：同步服务**
   - 新增 `resource.constants.ts`、`resource.types.ts`、`resource.enums.ts`
   - 新增 `resource-http.client.ts`、`resource-manifest.ts`、`resource-sync.service.ts`
   - 新增 IPC 通道（`resource.ipc.ts` + preload 模块）
   - `main/index.ts` 接入启动时异步同步

5. **Phase 5：废弃清理**
   - 移除 `skill.updater.ts` 的 `remoteUpdateUrl` 机制
   - 移除 `skill.manager.ts` 的 `syncBuiltInSkills` 逻辑
   - 移除 `SkillSource.remote` 枚举值
   - 日志提示废弃 `<skillsDir>/built-in/` 目录

6. **Phase 6：UI 增强**
   - `TemplateSettings.vue` 新增来源标识、版本号、tags 筛选、profession 多选筛选
   - 设置页新增"立即检查模板更新"按钮（调用 `resource:syncNow`）

7. **Phase 7：测试**
   - 单元测试覆盖 manifest 比对、HTTP 客户端、同步服务
   - 集成测试覆盖端到端同步流程
   - 回归测试 slash/page/skill 加载与执行

## 风险与缓解

| 风险 | 缓解措施 |
|---|---|
| GitHub raw URL 限频（60 次/小时匿名） | manifest 仅 1 次请求 + 变更文件按需下载，单次同步通常 < 5 请求 |
| 网络不稳定导致同步失败 | 静默失败 + 本地缓存兜底，不影响应用启动 |
| 远程 manifest 损坏 | JSON 解析失败时回退到本地 manifest，记日志 |
| 用户工作区 resources 目录被误改 | sha256 校验失败时重新下载；不主动删除用户文件 |
| 旧版本用户升级后 `<skillsDir>/built-in/` 残留 | 标记废弃、日志提示、不主动删除 |
| 分支配置错误（main vs dev） | 常量集中管理，可配置；默认 main 分支 |
