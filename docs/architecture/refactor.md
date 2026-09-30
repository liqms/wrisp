# Pentip 重构计划

> 本文档描述从当前源码状态到目标架构（详见 [`tech.md`](tech.md)）的重构步骤。
> 源码扫描时间：2026-06-28，基于实际代码库验证。
> 详见：[`structure.md`](structure.md)（目标结构）| [`plan.md`](plan.md)（版本节奏）

---

## 一、术语统一 — P0（capture → journal）

### 1.1 命名映射

当前代码中 `capture` 层承载了"日志块编辑"功能，目标统一为 `journal`：

| 当前命名                     | 目标命名          | 涉及范围                                                         |
| :--------------------------- | :---------------- | :--------------------------------------------------------------- |
| `/capture` 路由              | `/journal`        | `src/renderer/router/index.ts`                                   |
| `CaptureView.vue`            | `JournalView.vue` | `views/` 目录                                                    |
| `capture.store`              | `journal.store`   | `store/` 目录                                                    |
| `capture.ipc` 通道           | `journal` IPC     | `ipcMain/capture.ipc.ts`                                         |
| `capture.api` 模块           | `journal.api`     | `core/apis/capture.api.ts`                                       |
| `capture.service`            | `journal.service` | `core/services/capture.service.ts`                               |
| `preload/modules/capture.ts` | `journal` 模块    | `preload/modules/capture.ts`                                     |
| `useCapture` composable      | `useJournal`      | `composables/useCapture.ts`                                      |
| `capture.enums`              | `journal.enums`   | `shared/enums/capture.enums.ts`                                  |
| `capture.types`              | `journal.types`   | `shared/types/capture.types.ts` + `main/types/db/block.types.ts` |

### 1.2 涉及文件清单

**Renderer 层（3 个文件）：**

| 文件                                     | 操作   | 说明                                                                                                               |
| :--------------------------------------- | :----- | :----------------------------------------------------------------------------------------------------------------- |
| `src/renderer/router/index.ts`           | 修改   | `/capture` → `/journal`，组件导入 `CaptureView` → `JournalView`；侧边栏标签 `capture` → `journal`（MenuLayout 中） |
| `src/renderer/views/CaptureView.vue`     | 重命名 | → `JournalView.vue`                                                                                                |
| `src/renderer/store/capture.store.ts`    | 重命名 | → `journal.store.ts`，类/导出名 `CaptureStore` → `JournalStore`                                                    |
| `src/renderer/composables/useCapture.ts` | 重命名 | → `useJournal.ts`，函数名 `useCapture` → `useJournal`                                                              |
| `src/renderer/components/`               | 修改   | 所有 `import` 用户 `capture.store` 的路径更新                                                                      |

**Main Process 层（7 个文件）：**

| 文件                                        | 操作   | 说明                                                             |
| :------------------------------------------ | :----- | :--------------------------------------------------------------- |
| `src/main/ipcMain/capture.ipc.ts`           | 重命名 | → `journal.ipc.ts`，通道名前缀 `capture:` → `journal:`           |
| `src/main/ipcMain/index.ts`                 | 修改   | import 路径 + 注册名                                             |
| `src/main/core/apis/capture.api.ts`         | 重命名 | → `journal.api.ts`，类/方法名 `Capture` → `Journal`              |
| `src/main/core/apis/index.ts`               | 修改   | import/export 路径                                               |
| `src/main/core/services/capture.service.ts` | 重命名 | → `journal.service.ts`，类名 `CaptureService` → `JournalService` |
| `src/main/preload/modules/capture.ts`       | 重命名 | → `journal.ts`，通道名 `capture:` → `journal:`                   |
| `src/main/preload/modules/index.ts`         | 修改   | import/export 路径                                               |

**Shared 层（2 个文件）：**

| 文件                                | 操作   | 说明                                                             |
| :---------------------------------- | :----- | :--------------------------------------------------------------- |
| `src/shared/enums/capture.enums.ts` | 重命名 | → `journal.enums.ts`，枚举名/值 `Capture` → `Journal`            |
| `src/shared/types/capture.types.ts` | 重命名 | → `journal.types.ts`，类型名 `Capture*` → `Journal*`             |
| `src/main/types/db/block.types.ts`  | 修改   | 类型名中的 `Capture` → `Journal`（由 P1.1 block→chunk 一并处理） |

### 1.3 执行步骤

```
步骤 1  Shared: enums + types     (capture.enums → journal.enums, capture.types → journal.types)
步骤 2  DAO: 无变化                (block 改名属 P1，不在此处处理)
步骤 3  Services: capture.service → journal.service
步骤 4  APIs:   capture.api → journal.api
步骤 5  IPC:    capture.ipc → journal.ipc
步骤 6  Preload: capture.ts → journal.ts
步骤 7  Router: /capture → /journal, CaptureView → JournalView
步骤 8  Store:  capture.store → journal.store
步骤 9  Composables: useCapture → useJournal
步骤 10 验证: pnpm typecheck, pnpm build
```

---

## 二、架构清理 — P1

### 2.1 DAO 统一：block → chunk

> ⚠ 数据库表名当前为 `blocks`（非 `semantic_chunks`），DAO 内的 `tableName` 属性需同步修改。
> 本步骤仅重命名 DAO 文件 + 类型文件，表迁移见 2.1-附录。

**底层约定：**

- DAO 类名：`BlockDao` → `ChunkDao`
- DAO 文件名：`block.dao.ts` → `chunk.dao.ts`
- 类型文件名：`block.types.ts` → `chunk.types.ts`
- 类型名：`Block` → `Chunk`，`BlockCreate` → `ChunkCreate`，`BlockUpdate` → `ChunkUpdate` 等
- 数据库 `tableName`：`blocks` → `semantic_chunks`（将在 DAO 属性中修改）
- 关联表 DAO 中的外键字段 `block_id` → `chunk_id` 保持现状（仅在 DAO 属性层映射）

| 步骤 | 操作                      | 涉及文件                                                                                       |
| :--- | :------------------------ | :--------------------------------------------------------------------------------------------- |
| 1    | 重命名文件 + 类名         | `src/main/core/db/block.dao.ts` → `chunk.dao.ts`                                               |
| 2    | 更新 index.ts 导出        | `src/main/core/db/index.ts`                                                                    |
| 3    | 更新所有 import 引用      | `core/apis/*.api.ts`, `core/services/*.service.ts`, `core/smart-tasks/*.ts` 中引用 `block.dao` |
| 4    | 重命名类型文件            | `src/main/types/db/block.types.ts` → `chunk.types.ts`                                          |
| 5    | 更新主进程 types/index.ts | `src/main/types/db/index.ts` - import/export 路径                                              |
| 6    | 同步更新 shared types     | `src/shared/types/journal.types.ts` 中引用 `Block` 类型统一为 `Chunk`                          |
| 7    | 修改 DAO 内 tableName     | `chunk.dao.ts` 中 `tableName = 'blocks'` → `tableName = 'semantic_chunks'`                     |

> **附录：表名变更说明**
>
> 将 `block_id` 主键名改为 `chunk_id`、表名 `blocks` → `semantic_chunks` 涉及 Schema 变更。

### 2.2 关联表 DAO 统一：`*Block` → `*Chunk`

当前 5 个关联表 DAO 文件名含 `Block`：

| 当前 DAO                 | 目标 DAO                 | 说明                                 |
| :----------------------- | :----------------------- | :----------------------------------- |
| `conceptBlock.dao.ts`    | `conceptChunk.dao.ts`    | 表中 `block_id` 外键指向 `blocks.id` |
| `topicBlock.dao.ts`      | `topicChunk.dao.ts`      | 同上                                 |
| `reflectionBlock.dao.ts` | `reflectionChunk.dao.ts` | 同上                                 |
| `projectBlock.dao.ts`    | `projectChunk.dao.ts`    | 同上                                 |

每个文件的修改模式一致：重命名文件 → 重命名类名 → 更新 `index.ts` → 更新所有 import。

> 建议在 2.1 块 rename 稳定后，使用 IDE 全局搜索替换 `conceptBlock` → `conceptChunk`，确保无遗漏。

### 2.3 Smart Tasks 执行器命名统一

`smart-tasks/executors/` 中 2 个文件由 `block-` 前缀改为 `chunk-`：

| 步骤 | 当前文件                      | 目标文件                               |
| :--- | :---------------------------- | :------------------------------------- |
| 1    | `block-summary.executor.ts`   | `chunk-summary.executor.ts`            |
| 2    | `block-vectorize.executor.ts` | `chunk-vectorize.executor.ts`          |
| 3    | 更新 `smart-tasks/index.ts`   | import/export 路径 + task-dag 中注册名 |
| 4    | 更新 `progress.manager.ts`    | 引用的执行器名                         |

### 2.4 视图与路由清理

**当前实际路由：**

| 路径        | 视图                                  | 处理方式   |
| :---------- | :------------------------------------ | :--------- |
| `/welcome`  | `Welcome.vue`                         | 保留       |
| `/capture`  | `CaptureView.vue` → `JournalView.vue` | 由 P0 处理 |
| `/chat`     | `webview/ChatView.vue`                | 保留       |
| `/projects` | `ProjectView.vue`                     | 保留       |

**涉及文件：**

| 文件                                      | 操作                                                                                      |
| :---------------------------------------- | :---------------------------------------------------------------------------------------- |
| `src/renderer/router/index.ts`            | 由 P0 处理 `/capture` → `/journal`；保留 `/chat` 路由定义但 `MenuLayout` 中不暴露导航入口 |
| `src/renderer/layouts/MenuLayout.vue`     | 侧边栏导航项：[Journal, Wiki（!新建）, Projects]；去掉 `capture` 硬编码标签改用 i18n      |
| `src/renderer/views/webview/ChatView.vue` | 保留不动，Phase 2 时评估是否替换为内嵌 AI 对话组件                                        |

### 2.5 Store 统一

| 步骤 | 文件                                    | 操作                                                                                   |
| :--- | :-------------------------------------- | :------------------------------------------------------------------------------------- |
| 1    | `capture.store.ts` → `journal.store.ts` | 由 P0 处理                                                                             |
| 2    | 全部 Store 统一 Composition API         | 确认所有 Store 使用 `defineStore` + `setup()` 模式，替换 Options API 风格（如有）      |
| 3    | 补充 `ai.store.ts` ※                    | 新建，管理 Skills/Agent（规划）/Chat（对话）状态                                       |
| 4    | 补充 `wiki.store.ts` ※                  | 新建，管理概念/主题/反思查询状态（数据由 `concept`/`topic`/`reflection` IPC 通道提供） |

### 2.6 IPC 层清理 + think → concept / topic / reflection 拆分

当前 `think.ipc.ts` 注册 6 个通道（`think:concept:*`、`think:topic:*`、`think:reflection:*`、`think:temporal:*`），
目标拆分为 3 个独立 IPC 域 `concept` / `topic` / `reflection`，通道名前缀对应改为 `concept:*` / `topic:*` / `reflection:*`：

| 步骤 | 操作                                                                                           | 涉及文件                                                                                                                      |
| :--- | :--------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| 1    | `capture.ipc.ts` → `journal.ipc.ts` + 通道名前缀 `capture:` → `journal:`                       | 由 P0 处理                                                                                                                    |
| 2    | `think.ipc.ts` → 拆分：`concept.ipc.ts` / `topic.ipc.ts` / `reflection.ipc.ts`                 | 原 6 通道按域拆分，通道名 `think:concept:*` → `concept:*` 等（去掉 `think:` 前缀层）                                          |
| 3    | `think.api.ts` → 拆分：`concept.api.ts` / `topic.api.ts` / `reflection.api.ts`                 | `core/apis/think.api.ts` 拆为 3 个文件                                                                                        |
| 4    | `think.service.ts` → 拆分：`concept.service.ts` / `topic.service.ts` / `reflection.service.ts` | `core/services/think.service.ts` 拆为 3 个文件                                                                                |
| 5    | Preload 拆分                                                                                   | `preload/modules/think.ts` → `concept.ts` / `topic.ts` / `reflection.ts`；注册名 `think` → `concept` / `topic` / `reflection` |
| 6    | 新增 `search.ipc.ts` ※                                                                         | 新建，统一管理全局搜索（FTS5 + 向量搜索）                                                                                     |
| 7    | 新增 Preload 模块                                                                              | `search.ts` ※                                                                                                                 |

### 2.7 DB 实体类型统一

`src/main/types/db/` 中与 `block` 相关的类型文件：

| 当前文件                   | 目标文件                   | 说明                  |
| :------------------------- | :------------------------- | :-------------------- |
| `block.types.ts`           | `chunk.types.ts`           | 主要类型，由 2.1 处理 |
| `conceptBlock.types.ts`    | `conceptChunk.types.ts`    | 关联表类型            |
| `reflectionBlock.types.ts` | `reflectionChunk.types.ts` | 同上                  |
| `projectBlock.types.ts`    | `projectChunk.types.ts`    | 同上                  |
| `topicBlock.types.ts`      | `topicChunk.types.ts`      | 同上                  |

所有 \*Block 类型的字段 `block_id` → `chunk_id`、`BlockExt` → `ChunkExt` 等。

### 2.8 移除已废弃模块

以下模块在当前代码中存在但在 target 架构中不独立存在，**Phase 1 期间保留**，标记为 Phase 2 移除：

| 模块         | 文件            | 保留原因           | 最终归宿        |
| :----------- | :-------------- | :----------------- | :-------------- |
| `smart-task` | ipc/API/preload | 独立调度层，需保留 | 合并到 'ai'     |
| `skill`      | ipc/API/preload | 独立 Skills 引擎   | 合并到 'ai'     |
| `window`     | ipc/preload     | 窗口控制           | 合并到 'system' |

### 2.9 前端组件清理与重命名

| 步骤 | 文件 | 操作 |
| :--- | :--- | :--- |
| 1 | `src/renderer/components/editor/NewBlockCreator.vue` | **清理**（移除，不再使用） |
| 2 | `src/renderer/components/editor/TiptapToolbar.vue` | **清理**（移除，不再使用） |
| 3 | `src/renderer/components/editor/SemanticBlockItem.vue` | **重命名** → `SemanticBlock.vue` |
| 4 | `src/renderer/components/editor/SemanticGroup.ts` | **保留**（接口定义保留不动） |
| 5 | `src/renderer/components/MiniProgramBar.vue` | **清理**（移除，不再使用） |
| 6 | `src/renderer/components/FunctionCard.vue` | **移入** → `components/base/FunctionCard.vue` |
| 7 | `src/renderer/components/NotificationHandler.vue` | **重命名** → `NotificationToast.vue`（同时清理 ※ 标记） |
| 8 | `src/renderer/components/WebView.vue` | **重命名** → `WebViewContainer.vue`（同时清理 ※ 标记） |

### 2.10 基础设施合并

| 步骤 | 操作 | 涉及路径 |
| :--- | :--- | :--- |
| 1 | **迁移文件合并**：将 `core/migration/schemas/migrations/1.0.1_add_smart_task_tables.sql` 移至 `src/main/schemas/migrations/`，清理重复目录 | `core/migration/schemas/migrations/` → `src/main/schemas/migrations/` |
| 2 | **DAO 索引补充**：将 `skill-execution.dao.ts` 添加到 `core/db/index.ts` 导出 | `src/main/core/db/index.ts` |
| 3 | **共享类型迁移**：将 `src/shared/types/index.ts` 中的 `@/main/types/db/tag.types` 跨层引用移除，新建 `src/shared/types/tag.types.ts`，调整主进程 `types/db/index.ts` 导出 | 共享层 `index.ts` + 主进程 `types/db/index.ts` |

### 2.11 其他清理

- `services/index.ts` 不存在，已从重构步骤中移除所有对该文件的引用。
- 重构后的 infrastructure 合并操作建议在 Sprint 2 末尾统一执行，避免干扰 rename-only 流程。

---

## 三、目标模块创建 — P2

按 [structure.md](structure.md) 定义的完整架构，创建以下缺失模块。

### 3.1 共享层

| 新建文件                                  | 职责                           | 数据来源 / 参考                            |
| :---------------------------------------- | :----------------------------- | :----------------------------------------- |
| `src/shared/enums/journal.enums.ts`       | Journal 块状态、语义块类型枚举 | 从 `capture.enums.ts` 重构                 |
| `src/shared/types/journal.types.ts`       | Journal 块类型定义             | 合并 `capture.types.ts` + `block.types.ts` |
| `src/shared/types/concept.types.ts` ※     | 概念查询参数与返回结构         | 由 `think` 拆分                            |
| `src/shared/types/topic.types.ts` ※       | 主题查询参数与返回结构         | 由 `think` 拆分                            |
| `src/shared/types/reflection.types.ts` ※  | 反思查询参数与返回结构         | 由 `think` 拆分                            |
| `src/shared/types/tag.types.ts`           | 标签相关类型（从主进程移入）   | 由 `@/main/types/db/tag.types` 迁移        |
| `src/shared/types/search.types.ts` ※      | 搜索参数/分组/高亮类型         | 新建                                       |

### 3.2 主进程层

| 新建文件                                         | 职责                                                               | 备注 |
| :----------------------------------------------- | :----------------------------------------------------------------- | :--- |
| `ipcMain/concept.ipc.ts`                         | concept IPC 通道（由 `think.ipc.ts` 拆分，`concept:*` 前缀）       |      |
| `ipcMain/topic.ipc.ts`                           | topic IPC 通道（由 `think.ipc.ts` 拆分，`topic:*` 前缀）           |      |
| `ipcMain/reflection.ipc.ts`                      | reflection IPC 通道（由 `think.ipc.ts` 拆分，`reflection:*` 前缀） |      |
| `ipcMain/search.ipc.ts` ※                        | 搜索 IPC 通道（新建）                                              |      |
| `core/apis/concept.api.ts`                       | 由 `think.api.ts` 拆分，concept 相关                               |      |
| `core/apis/topic.api.ts`                         | 由 `think.api.ts` 拆分，topic 相关                                 |      |
| `core/apis/reflection.api.ts`                    | 由 `think.api.ts` 拆分，reflection 相关                            |      |
| `core/apis/search.api.ts` ※                      | 搜索 API 封装（新建）                                              |      |
| `core/services/concept.service.ts`               | 由 `think.service.ts` 拆分                                         |      |
| `core/services/topic.service.ts`                 | 由 `think.service.ts` 拆分                                         |      |
| `core/services/reflection.service.ts`            | 由 `think.service.ts` 拆分                                         |      |
| `core/services/search.service.ts` ※              | 全局搜索逻辑（新建）                                               |      |
| `core/services/update.service.ts` ※              | 应用更新（新建，electron-updater 封装）                            |      |
| `core/services/base/backup.service.ts` ※         | 备份/恢复（新建）                                                  |      |
| `core/services/base/workspace-init.service.ts` ※ | 首次工作空间扫描（新建）                                           |      |
| `core/services/base/file.service.ts` ※           | 文件管理（新建，同步/hash 比对）                                   |      |
| `core/services/base/auto.service.ts` ※           | 自动任务（新建，空闲检测/后台处理）                                |      |
| `preload/modules/concept.ts`                     | concept preload 模块（`window.electronAPI.concept`）               |      |
| `preload/modules/topic.ts`                       | topic preload 模块（`window.electronAPI.topic`）                   |      |
| `preload/modules/reflection.ts`                  | reflection preload 模块（`window.electronAPI.reflection`）         |      |
| `preload/modules/search.ts` ※                    | search preload 模块（新建）                                        |      |
| `core/db/chunk.dao.ts`                           | 由 `block.dao.ts` rename                                           |      |
| `core/db/conceptChunk.dao.ts`                    | 由 `conceptBlock.dao.ts` rename                                    |      |
| `core/db/topicChunk.dao.ts`                      | 由 `topicBlock.dao.ts` rename                                      |      |
| `core/db/reflectionChunk.dao.ts`                 | 由 `reflectionBlock.dao.ts` rename                                 |      |
| `core/db/projectChunk.dao.ts`                    | 由 `projectBlock.dao.ts` rename                                    |      |
| `core/db/skill-execution.dao.ts`                 | 补充到 `index.ts` 导出（当前文件存在但未索引）                    |      |
> 注：共享层文件（`shared/enums/journal.*`、`shared/types/journal.*`、`shared/types/concept.*`、`shared/types/topic.*`、`shared/types/reflection.*`、`shared/types/tag.*`、`shared/types/search.*`）见 §3.1 共享层，此处不再重复。`wiki.types.ts` 已拆分为 `concept.types.ts` / `topic.types.ts` / `reflection.types.ts`。

### 3.3 渲染层 — Store

| 新建文件                   | 职责                                |
| :------------------------- | :---------------------------------- |
| `store/ai.store.ts` ※      | AI Skills/Agent/Chat 3 个子状态管理 |
| `store/journal.store.ts` ※ | 由 P0 从 `capture.store.ts` rename  |
| `store/wiki.store.ts` ※    | 概念/主题/反思查询状态管理          |

### 3.4 渲染层 — Composables

| 新建文件                      | 职责                                   |
| :---------------------------- | :------------------------------------- |
| `composables/useJournal.ts` ※ | 由 P0 从 `useCapture.ts` rename        |
| `composables/useWiki.ts` ※    | 封装 concept/topic/reflection IPC 调用 |
| `composables/useSearch.ts` ※  | 搜索 API 封装                          |

### 3.5 渲染层 — Views

| 新建文件                  | 职责           | 子组件                                                                                     |
| :------------------------ | :------------- | :----------------------------------------------------------------------------------------- |
| `views/JournalView.vue` ※ | 每日日志主视图 | BlockEditor + SemanticBlock 语义分区                                                       |
| `views/WikiView.vue` ※    | 知识体系视图   | ConceptGraph（concept 数据源）+ TopicList（topic 数据源）+ 反思时间线（reflection 数据源） |

### 3.6 渲染层 — Components

| 新建文件                                            | 职责                        |
| :-------------------------------------------------- | :-------------------------- |
| `components/base/GlobalSearch.vue` ※                | 全局搜索入口（Ctrl+K）      |
| `components/base/NotificationToast.vue` ※           | 通知提示组件                |
| `components/base/UpdatePrompt.vue` ※                | 版本更新提示                |
| `components/base/WebViewContainer.vue` ※            | WebView 容器（AI 对话嵌入） |
| `components/editor/BlockEditor.vue` ※               | Journal 块行内编辑器        |
| `components/editor/ContextMenu.vue` ※               | 编辑器右键菜单              |
| `components/editor/SemanticBlock.vue` ※             | 语义块视觉分区              |
| `components/editor/EditorQuickActions.vue` ※        | 编辑器 AI 快捷操作          |
| `components/wiki/ConceptGraph.vue` ※                | 概念网络气泡图              |
| `components/wiki/TopicList.vue` ※                   | 主题聚类列表                |
| `components/project/ProjectList.vue` ※              | 项目列表/卡片               |
| `components/project/OutlineTree.vue` ※              | 页面大纲树（拖拽排序）      |
| `components/project/AiAssistantPanel.vue` ※         | AI 助手面板                 |
| `components/settings/general/DataManagement.vue` ※          | 数据管理设置                |
| `components/welcome/WelcomeWorkspaceStep.vue` ※     | 向导：工作空间选择          |
| `components/welcome/WelcomeModelDownloadStep.vue` ※ | 向导：模型下载              |
| `components/welcome/WelcomeApiConfigStep.vue` ※     | 向导：API 配置              |

---

## 四、数据库迁移检查

SQLite 表结构当前稳定，重构期间建议不做 Schema 变更：

| 检查项                                      | 状态                         | 说明                                                       |
| :------------------------------------------ | :--------------------------- | :--------------------------------------------------------- |
| 表 `blocks` → `semantic_chunks` 重命名      | Phase 1 执行                 | 涉及所有外键关联表，重新生成初始化脚本。                   |
| 新增 `chunk.dao`（文件 rename）             | Phase 1 执行                 | 仅文件层 rename，DAO 内 `tableName` 保持 `semantic_chunks` |
| 关联表中 `block_id` → `chunk_id` 字段重命名 | Phase 1 执行                 |                                                            |
| 新建 FTS5 索引                              | 已存在 `semantic_chunks_fts` | 无需新建                                                   |
| 字段变更                                    | 无                           | 当前 schema 满足 Phase 1                                   |

---

## 五、重构顺序建议

```
Sprint 1: 术语统一 P0
    输出：capture → journal 命名替换，类型/文件全部对齐
    步骤：Shared → Services → APIs → IPC → Preload → Router → Store → Composables
    验证：pnpm typecheck, pnpm build

Sprint 2: 架构清理 P1（rename-only）
    ├── 2.1 DAO: block.dao → chunk.dao（文件 rename + import 更新）
    ├── 2.2 关联表 DAO: *Block → *Chunk（5 个文件，批量 rename）
    ├── 2.3 Smart Tasks: block- → chunk-（2 个文件）
    ├── 2.4 视图/路由清理（MenuLayout 导航、/chat 入口隐藏）
    ├── 2.5 Store 统一（新建 ai.store、wiki.store）
    ├── 2.6 IPC 层 + API + Service + Preload：think 拆分为 concept/topic/reflection
    ├── 2.7 DB 类型统一（block.types → chunk.types + 4 个关联类型）
    ├── 2.9 前端组件清理与重命名（清理 NewBlockCreator/TiptapToolbar/MiniProgramBar，重命名 SemanticBlock/NotificationToast/WebViewContainer，移动 FunctionCard）
    ├── 2.10 基础设施合并（迁移文件合并、DAO 索引补充、tag.types 共享层迁移）
    验证：pnpm typecheck, pnpm build, 手动验证 Journal/Project/Wiki 功能

Sprint 3: 目标模块创建 P2
    ├── 主进程：search/update/backup/workspace-init/file/auto Services + concept/topic/reflection Preload
    ├── 渲染层 Store：ai.store, wiki.store
    ├── 渲染层 Views：JournalView, WikiView
    ├── 渲染层 Components（全局/编辑器/视图专用/设置/向导）
    ├── 渲染层 Composables：useJournal, useWiki, useSearch
    └── 共享层：concept.types, topic.types, reflection.types, tag.types, search.types
    验证：pnpm typecheck, pnpm build

Sprint 4: 回归验证
    ├── pnpm typecheck（零错误）
    ├── pnpm lint（零 warning）
    ├── pnpm build（构建成功）
    ├── 手动功能覆盖回归（详见 §6）
    └── 确认无回归 bug，提交 PR
```

---

## 六、回归测试清单

| 模块     | 测试项                             | 验证方式             |
| :------- | :--------------------------------- | :------------------- |
| Journal  | 创建块、编辑、删除                 | 手动操作 + 文件验证  |
| Journal  | 标签/双链自动补全                  | 手动操作             |
| Journal  | 语义拆分（>300 字）                | 检查 semantic_chunks |
| Journal  | 语义链接自动生成                   | 检查 semantic_links  |
| 全局搜索 | 向量搜索优先 + FTS5 兜底           | 输入关键词验证       |
| 文件同步 | 文件变更检测 + 增量同步            | 检查 file_index hash |
| Wiki     | 概念提取、主题聚类                 | 手动操作             |
| Wiki     | 概念网络气泡图渲染                 | 手动操作             |
| Project  | 创建/编辑/删除项目                 | 手动操作             |
| Project  | AI Skills（续写/润色/引用）        | 手动操作             |
| Project  | 大纲树拖拽排序                     | 手动操作             |
| 模型管理 | 下载/切换/删除模型                 | 手动操作             |
| 数据管理 | 工作空间路径切换                   | 手动操作             |
| 数据管理 | 备份与恢复                         | 手动操作             |
| 应用更新 | 更新检查/下载/安装                 | 手动操作             |
| 首次启动 | 工作空间选择 → 模型下载 → API 配置 | 完整流程验证         |
| 首次启动 | 向导可跳过，后续在设置中完成       | 手动操作             |

---

## 七、风险与回退

| 风险                                                                                | 影响     | 应对                                                                             |
| :---------------------------------------------------------------------------------- | :------- | :------------------------------------------------------------------------------- |
| DB 表 `blocks` 未重命名但 DAO 已改为 `chunk.dao`                                    | 开发混淆 | 在 DAO 注释和文档中注明 `tableName = 'blocks'`（计划 Phase 2 迁移表名）          |
| `capture` → `journal` / `think` → `concept`+`topic`+`reflection` rename 遗漏 import | 编译错误 | 执行 `pnpm typecheck` 全量检测，补全遗漏                                         |
| 文件重命名后 import 断连                                                            | 编译错误 | 使用 IDE 重构重命名（而非手动 rename），IDE 会自动更新引用                       |
| Sprint 3 新建组件多、耗时                                                           | 延迟交付 | 可拆分子 Sprint：先核心（Store/View/Composable），后边缘（settings/wizard 组件） |
| 重构期间新功能开发冲突                                                              | 合并冲突 | 建议重构 Sprint 期间冻结新功能开发                                               |

> **回退策略：** 每个 Sprint 结束后提交并打 tag。若出现严重问题，通过 `git revert` 回退到上一个 tag。
