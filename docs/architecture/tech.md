# Pentip 技术方案（v5）

> 文档版本：v5（适配"文件优先，数据库索引"架构，对齐 PRD v3 + MRD v2 + SQLite v2 + LanceDB v2 + Model v2.2）
> 本文档描述 Pentip 的目标架构，作为后续项目改造的技术蓝图。重构计划详见 [`refactor.md`](refactor.md)。
> 最后更新：2026-06-28

---

## 一、方案概述

### 1.1 产品定位

Pentip 是一个以 Markdown 文件为数据源，以 AI 为智能索引的认知工作台。核心理念：

| 理念                 | 说明                                                          |
| :------------------- | :------------------------------------------------------------ |
| **File First**       | Markdown 文件是真实数据源，用户拥有完整控制权                 |
| **AI Native**        | AI 不是插件，而是工作流本身——嵌入记录、整理、推演、创作全流程 |
| **Local First**      | 数据完全本地可控，隐私安全，离线可用                          |
| **Flow → Structure** | 日志流自然输入，知识体系自动生长                              |

### 1.2 技术目标

| 目标        | 要求                           | 对应架构                        |
| :---------- | :----------------------------- | :------------------------------ |
| File First  | 用户数据以标准 .md 文件存储    | Markdown 文件系统 + SQLite 索引 |
| Local First | 用户数据完全本地可控           | SQLite + 本地文件系统           |
| AI Native   | AI 能力嵌入核心工作流          | Hybrid Cognitive Architecture   |
| 零配置      | 安装即可用，无需 Python/Ollama | Embedded Model Manager          |
| 跨平台      | Windows / macOS / Linux        | Electron                        |

### 1.3 核心交互流程

```
用户记录（Journal） → AI 整理（Wiki） → AI 推演（Reflection） → 创作（Project）
```

- **Journal**：每日日志页，Markdown 文件编辑模式，块（Block）为最小编辑单元
- **Wiki**：AI 自动整理的概念网络 + 主题聚类
- **Reflection**：AI 主动推送的反思洞察（Phase 2）
- **Project**：按作品创作，AI 辅助大纲生成、续写、润色

---

## 二、系统架构总览

### 2.1 五层架构

```
┌─────────────────────────────────────────────────────────────────┐
│  Interface Layer（交互层）                                       │
│  Vue 3 + Naive UI + Pinia + Vue Router + Vue I18n              │
│  视图：Welcome / Journal / Wiki / Projects / Settings           │
├─────────────────────────────────────────────────────────────────┤
│  Service Layer（服务层）                                         │
│  IPC Handler → API Adapter → Business Service                   │
│  Preload Modules（contextBridge 暴露）                          │
│  config / journal / project / ai / model / tag / concept / topic / reflection / ...    │
├─────────────────────────────────────────────────────────────────┤
│  Cognitive Layer（AI 认知层）                                    │
│  Semantic Engine / Crystallization Engine / Reflection Engine   │
│  Node.js Worker Threads / llama.cpp / MLX                       │
├─────────────────────────────────────────────────────────────────┤
│  Knowledge Layer（知识层）                                       │
│  Semantic Chunk + Concept + Topic + Temporal Memory             │
│  SQLite（结构化）+ LanceDB（向量）+ FTS5（全文搜索）            │
├─────────────────────────────────────────────────────────────────┤
│  Storage Layer（存储层）                                         │
│  Markdown 文件系统（真实来源）                                   │
│  journal/*.md  /  projects/*.md  /  assets/                     │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 运行时架构

```
┌─────────────┐     IPC（contextBridge）     ┌──────────────────────────┐
│  Renderer   │ ◄─────────────────────────► │     Main Process          │
│  Process    │         Preload Modules      │                           │
│             │                              │  ┌─────────────────────┐  │
│  Vue 3 App  │                              │  │  Service Layer       │  │
│  Pinia (11) │                              │  │  ┌───────────────┐  │  │
│  Router (4) │                              │  │  │ IPC Handlers   │  │  │
│  Naive UI   │                              │  │  │  (13 channels) │  │  │
│             │                              │  │  └───────┬───────┘  │  │
│             │                              │  │          │          │  │
│             │                              │  │  ┌───────▼───────┐  │  │
│             │                              │  │  │ Core APIs     │  │  │
│             │                              │  │  │  (13 modules) │  │  │
│             │                              │  │  └───────┬───────┘  │  │
│             │                              │  │          │          │  │
│             │                              │  │  ┌───────▼───────┐  │  │
│             │                              │  │  │ Business      │  │  │
│             │                              │  │  │ Services (11) │  │  │
│             │                              │  │  └───────┬───────┘  │  │
│             │                              │  └──────────┼──────────┘  │
│             │                              │             │            │
│             │                              │  ┌──────────▼──────────┐  │
│             │                              │  │   DAO Layer (20)     │  │
│             │                              │  │  block / tag /       │  │
│             │                              │  │  taggedItem /        │  │
│             │                              │  │  semanticLink /      │  │
│             │                              │  │  concept / conceptBlock│
│             │                              │  │  topic / topicBlock /│  │
│             │                              │  │  topicConcept /      │  │
│             │                              │  │  temporalEvent /     │  │
│             │                              │  │  reflection /        │  │
│             │                              │  │  reflectionBlock /   │  │
│             │                              │  │  project / projectBlock│
│             │                              │  │  page / migrationDb /│  │
│             │                              │  │  skill-execution /   │  │
│             │                              │  │  vector / task /     │  │
│             │                              │  │  task-execution      │  │
│             │                              │  └──────────┬──────────┘  │
│             │                              │             │            │
│             │                              │  ┌──────────▼──────────┐  │
│             │                              │  │  SQLite (main.db)    │  │
│             │                              │  │  WAL模式 + FTS5      │  │
│             │                              │  └──────────┬──────────┘  │
│             │                              │             │            │
│             │                              │  ┌──────────▼──────────┐  │
│             │                              │  │  LanceDB (vectors/)  │  │
│             │                              │  │  IVF-PQ 索引         │  │
│             │                              │  └─────────────────────┘  │
│             │                              │                           │
│             │                              │  ┌─────────────────────┐  │
│             │                              │  │  Worker Threads      │  │
│             │                              │  │  Embedding / LLM     │  │
│             │                              │  │  Chunk Split /       │  │
│             │                              │  │  Clustering          │  │
│             │                              │  └─────────────────────┘  │
│             │                              │                           │
│             │                              │  ┌─────────────────────┐  │
│             │                              │  │  File System          │  │
│             │                              │  │  (.md 文件，真实来源) │  │
│             │                              │  └─────────────────────┘  │
└─────────────┘                              └──────────────────────────┘
```

---

## 三、前端架构设计（Interface Layer）

### 3.1 技术选型

| 功能     | 技术                       | 说明                         |
| :------- | :------------------------- | :--------------------------- |
| 框架     | Vue 3 + Composition API    | `<script setup lang="ts">`   |
| UI 库    | Naive UI                   | 组件丰富，主题支持好         |
| 状态管理 | Pinia                      | TypeScript 友好，响应式强    |
| 路由     | Vue Router（Hash History） | Electron 兼容                |
| 国际化   | Vue I18n                   | 中英文优先                   |
| 样式     | SCSS（sass-embedded）      | 全局样式 + Scoped            |
| 构建     | Vite                       | 与 vite-plugin-electron 集成 |

### 3.2 路由设计

当前路由（`src/renderer/router/index.ts`）：

| 路径        | 名称     | 视图组件          | 说明                           |
| :---------- | :------- | :---------------- | :----------------------------- |
| `/welcome`  | Welcome  | `Welcome.vue`     | 首次启动欢迎页 / 引导          |
| `/journal`  | Journal  | `JournalView.vue` | Journal 每日日志页，块编辑入口 |
| `/wiki`     | Wiki     | `WikiView.vue`    | AI 整理的知识体系（概念+主题） |
| `/projects` | Projects | `ProjectView.vue` | 创作项目管理 + 编辑器          |

所有路由嵌套在 `MenuLayout.vue` 下，侧边栏提供 Journal、Wiki、Projects 三个导航入口。

### 3.3 Pinia Store 设计

当前 Store（`src/renderer/store/`）：

| Store                | 用途                                                   |
| :------------------- | :----------------------------------------------------- |
| `ai.store`           | AI 智能层：Skills（技能）、Agent（规划）、Chat（对话） |
| `journal.store`      | Journal 捕获流状态、块编辑状态                         |
| `project.store`      | 创作项目、页面管理状态                                 |
| `wiki.store`         | Wiki 知识体系（概念/主题/反思）                        |
| `config.store`       | 应用配置（通用设置）                                   |
| `model.store`        | AI 模型配置、下载状态                                  |
| `download.store`     | 模型下载进度管理                                       |
| `tag.store`          | 标签管理                                               |
| `system.store`       | 系统信息                                               |
| `webview.store`      | WebView 会话管理                                       |
| `notification.store` | 通知管理                                               |

### 3.4 组件树

```
App.vue
├── 全局组件
│   ├── GlobalSearch.vue              # 全局搜索（Ctrl+K），任意页面触发
│   ├── NotificationToast.vue         # 通知组件，系统通知/推送展示
│   ├── UpdatePrompt.vue              # 更新记录组件，检查应用版本更新
│   ├── WebViewContainer.vue          # WebView 组件，嵌入第三方页面（AI 对话等）
│   └── Markdown 编辑器组件
│       ├── TiptapEditor.vue          # 通用编辑器组件（Journal / Project 共用）
│       ├── ContextMenu.vue               # 右键菜单组件
│       ├── SemanticBlock.vue         # 语义视觉分区组件
│       ├── SlashMenu.vue               # 斜杠菜单组件
│       ├── extension.ts                # Tiptap 扩展组件
│       └── EditorQuickActions.vue    # 编辑器快捷操作
├── MenuLayout.vue                    # 侧边栏 + 主内容区
│   ├── Sidebar                       # 导航：Journal / Wiki / Projects
│   └── <router-view>
│       ├── Welcome.vue               # 欢迎页 / 引导流程
│       │   └── 工作空间选择 → 模型下载 → API 配置
│       ├── JournalView.vue           # Journal 每日日志页
│       │   ├── BlockEditor.vue       # 块编辑器（行内编辑）
│       │   ├── 语义块视觉区分
│       │   └── 标签/双链自动补全
│       ├── WikiView.vue              # Wiki 知识体系（数据源：concept / topic / reflection IPC）
│       │   ├── ConceptGraph.vue      # 概念网络（气泡图）
│       │   └── TopicList.vue         # 主题聚类（卡片列表）
│       └── ProjectView.vue           # 创作工作台
│           ├── ProjectList.vue       # 项目列表
│           ├── CatalogTree.vue       # 页面目录树（悬浮大纲面板）
│           └── AiAssistantPanel.vue  # AI 助手面板（续写/润色/引用）
├── SettingsView.vue                  # 设置弹窗组件
│   ├── GeneralSettings.vue           # 通用设置
│   ├── ModelSettings.vue             # 模型管理
│   └── KeymapSettings.vue            # 快捷键
└── AppHeader.vue                     # 标题栏
```

---

## 四、主进程架构设计（Service Layer）

### 4.1 服务层总览

服务层由三部分组成，呈递进调用链：

```
Preload Module → IPC Handler → Core API → Business Service → DAO
    ↑                                                ↑
  前端接口层                                    后端能力封装
```

各模块职责：

| 层次                  | 职责                                    | 数量 |
| :-------------------- | :-------------------------------------- | :--- |
| **Preload Modules**   | 通过 contextBridge 暴露 API 给渲染进程  | 13   |
| **IPC Handlers**      | 注册 IPC 通道，参数校验，调用 Core API  | 13   |
| **Core APIs**         | 适配层，统一 ResponseWrapper 返回格式   | 13   |
| **Business Services** | 封装业务逻辑，组合多个 DAO 完成复杂操作 | 11   |

### 4.2 IPC 通信层

采用 4 层 IPC 模式：`preload module → API → ipcMain handler → Service/DAO`

当前 IPC 域（`src/main/ipcMain/`，共 13 个）：

| IPC 域  | 文件                | 职责                                               |
| :------ | :------------------ | :------------------------------------------------- |
| config  | `config.ipc.ts`     | 配置读写                                           |
| journal | `journal.ipc.ts`    | Journal 块 CRUD                                    |
| project | `project.ipc.ts`    | 项目与页面管理                                     |
| page    | `page.ipc.ts`       | 页面 CRUD、排序                                    |
| ai      | `ai.ipc.ts`         | AI 任务触发与状态查询, 调用 AI Skills,智能任务调度 |
| model   | `model.ipc.ts`      | 模型配置、下载管理                                 |
| tag     | `tag.ipc.ts`        | 标签管理                                           |
| wiki    | `concept.ipc.ts`    | 概念查询（列表/详情）                              |
|         | `topic.ipc.ts`      | 主题查询（列表/详情）                              |
|         | `reflection.ipc.ts` | 反思洞察查询（列表/详情）                          |
| task    | `task.ipc.ts`       | 后台任务管理                                       |
| webview | `webview.ipc.ts`    | WebView 生命周期                                   |
| system  | `system.ipc.ts`     | 系统信息                                           |
| logger  | `logger.ipc.ts`     | 日志记录                                           |
| search  | `search.ipc.ts`     | 搜索功能                                           |

### 4.3 Preload 模块

对应 IPC 域，`src/main/preload/modules/` 提供 15 个 preload 模块（由原 `think.ts` 拆分为 `concept.ts` / `topic.ts` / `reflection.ts`），通过 `contextBridge.exposeInMainWorld` 暴露给渲染进程。

### 4.4 API 层

`src/main/core/apis/` 提供 15 个 API 模块（`index.ts` 聚合），作为 IPC handler 与 Service/DAO 之间的适配层，统一返回 `ResponseWrapper` 格式。

当前 API 模块：

| API          | 文件                | 职责                                               |
| :----------- | :------------------ | :------------------------------------------------- |
| config.api   | `config.api.ts`     | 配置读写                                           |
| journal.api  | `journal.api.ts`    | Journal 块 CRUD                                    |
| project.api  | `project.api.ts`    | 项目与页面管理                                     |
| page.api     | `page.api.ts`       | 页面 CRUD、排序                                    |
| ai.api       | `ai.api.ts`         | AI 任务触发与状态查询, 调用 AI Skills,智能任务调度 |
| model.api    | `model.api.ts`      | 模型配置、下载管理                                 |
| tag.api      | `tag.api.ts`        | 标签管理                                           |
| wiki.api     | `concept.api.ts`    | 概念查询（列表/详情）                              |
|              | `topic.api.ts`      | 主题查询（列表/详情）                              |
|              | `reflection.api.ts` | 反思洞察查询（列表/详情）                          |
| task.api     | `task.api.ts`       | 后台任务管理                                       |
| webview\.api | `webview.api.ts`    | WebView 生命周期                                   |
| system.api   | `system.api.ts`     | 系统信息、系统通知、窗口管理、升级                 |
| logger.api   | `logger.api.ts`     | 日志记录                                           |
| search.api   | `search.api.ts`     | 搜索功能                                           |

### 4.5 Business Services

`src/main/core/services/` 提供 13 个服务模块（原 `think.service.ts` 拆分为 `concept.service.ts` / `topic.service.ts` / `reflection.service.ts`），封装业务逻辑给 API 调用：

| Service          | 文件                    | 职责                                          |
| :--------------- | :---------------------- | :-------------------------------------------- |
| ai.service       | `ai.service.ts`         | AI 任务编排、模型调度                         |
| journal.service  | `journal.service.ts`    | Journal 块管理、CRUD                          |
| config.service   | `config.service.ts`     | 配置管理（详见 [`app.md`](../config/app.md)） |
| model.service    | `model.service.ts`      | 模型下载/加载/卸载                            |
| page.service     | `page.service.ts`       | 页面 CRUD 逻辑                                |
| project.service  | `project.service.ts`    | 项目生命周期管理                              |
| tag.service      | `tag.service.ts`        | 标签 CRUD 逻辑                                |
| wiki.service     | `concept.service.ts`    | 概念查询逻辑（提取/搜索/合并）                |
|                  | `topic.service.ts`      | 主题查询逻辑（聚类检测/管理）                 |
|                  | `reflection.service.ts` | 反思洞察查询逻辑（趋势分析/矛盾检测）         |
| webview\.service | `webview.service.ts`    | WebView 生命周期管理                          |
| system.service   | `system.service.ts`     | 系统信息查询、系统通知、窗口管理、升级        |
| search.service   | `search.service.ts`     | 搜索功能                                      |

`src/main/core/services/base/` 提供 6 个服务模块，封装基础业务逻辑或仅后端调用：

| Service              | 文件                      | 职责                 |
| :------------------- | :------------------------ | :------------------- |
| notification.service | `notification.service.ts` | 系统通知管理         |
| cleanup.service      | `cleanup.service.ts`      | 定时清理任务         |
| vector.service       | `vector.service.ts`       | LanceDB 向量操作封装 |
| file.service         | `file.service.ts`         | 文件管理             |
| auto.service         | `auto.service.ts`         | 自动任务管理         |
| download.service     | `download.service.ts`     | 通用下载管理         |

### 4.6 DAO 层

所有 DAO 继承 `BaseDao<T, C, U>`，使用 better-sqlite3 + WAL 模式。

当前 DAO（`src/main/core/db/`，共 20 个 DAO 文件，不含 `base.dao`）：

| DAO                   | 对应表              | 说明               |
| :-------------------- | :------------------ | :----------------- |
| `chunk.dao`           | `semantic_chunks`   | 语义块 CRUD、搜索  |
| `tag.dao`             | `tags`              | 标签定义           |
| `taggedItem.dao`      | `tagged_items`      | 标签关联           |
| `semanticLink.dao`    | `semantic_links`    | 语义链接           |
| `concept.dao`         | `concepts`          | 概念实体           |
| `conceptChunk.dao`    | `concept_chunks`    | 概念-语义块关联    |
| `topic.dao`           | `topics`            | 主题               |
| `topicChunk.dao`      | `topic_chunks`      | 主题-语义块关联    |
| `topicConcept.dao`    | `topic_concepts`    | 主题-概念关联      |
| `temporalEvent.dao`   | `temporal_events`   | 时间事件           |
| `reflection.dao`      | `reflections`       | 反思洞察           |
| `reflectionChunk.dao` | `reflection_chunks` | 反思-语义块关联    |
| `project.dao`         | `projects`          | 创作项目           |
| `projectChunk.dao`    | `project_chunks`    | 项目-语义块关联    |
| `page.dao`            | `pages`             | 项目页面/章节      |
| `migrationDb.dao`     | `migrations_db`     | 数据库迁移版本     |
| `vector.dao`          | LanceDB             | 向量存储访问       |
| `task.dao`            | `tasks`             | 后台任务定义       |
| `taskExecution.dao`   | `task_executions`   | 任务执行记录       |
| `skillExecution.dao`  | `skill_executions`  | AI Skills 执行记录 |

---

## 五、AI 认知层架构（Cognitive Layer）

> 完整模型方案详见 [`model.md`](../model/model.md)（硬件配置、模型列表、路由设计、加载策略、配置界面）。本节仅描述架构集成要点。

### 5.1 整体 AI 架构：Hybrid Cognitive Architecture

```
┌──────────────────────────────────────┐
│  Cloud Intelligence Layer            │
│  GPT-4o / Claude / DeepSeek / Gemini │
│  深度推理 / 矛盾检测 / 跨领域关联     │
├──────────────────────────────────────┤
│  Language Cognitive Layer            │
│  Qwen3.5-4B-Instruct（推荐）         │
│  语义拆分 / 摘要 / 续写 / 润色       │
├──────────────────────────────────────┤
│  Universal Semantic Layer            │
│  jina-embeddings-v3 / bge-reranker-v2-m3 │
│  向量化 / 语义搜索 / 重排序          │
├──────────────────────────────────────┤
│  Embedded Runtime Layer              │
│  llama.cpp（Win/Linux）/ MLX（Mac）   │
│  模型推理后端，屏蔽硬件差异           │
└──────────────────────────────────────┘
```

### 5.2 Worker Thread 任务调度

AI 计算密集型任务在 Worker Thread 中执行，避免阻塞 UI：

```
Main Process
├── UI Thread（Electron Window）
├── Worker Pool
│   ├── Embedding Worker    # 向量生成（jina-embeddings-v3）
│   ├── LLM Worker          # 模型推理（llama.cpp / MLX）
│   ├── Chunk Split Worker  # 语义拆分
│   └── Clustering Worker   # 语义聚类
```

---

## 六、存储与知识层架构

> 存储方案详见 [`storage.md`](../storage/storage.md)（文件优先架构、三层数据模型），数据库设计详见 [`sqlite.md`](../storage/sqlite.md)（22 张表结构）和 [`lancedb.md`](../storage/lancedb.md)（向量库设计），用户数据目录详见 [`userData.md`](../storage/userData.md)。本节仅描述架构集成要点。

### 6.1 核心理念

**"文件优先，数据库索引"**：用户数据 = Markdown 文件（真实来源），智能能力 = SQLite + LanceDB（AI 索引）。AI 增强结果不写回 .md 文件。

### 6.2 存储集成架构

```
┌─────────────────┐      ┌─────────────────────┐
│   SQLite        │      │    LanceDB          │
│  (元数据)       │      │   (向量数据)         │
├─────────────────┤      ├─────────────────────┤
│ semantic_chunks │◄────►│ chunk_embeddings    │
│ concepts        │◄────►│ concept_embeddings  │
│ topics          │      │ topic_embeddings    │
│ semantic_links  │      │                     │
│ reflections     │      │                     │
│ temporal_events │      │                     │
│ projects        │      │                     │
│ pages           │      │                     │
│ tags            │      │                     │
└─────────────────┘      └─────────────────────┘
```

**协同原则**：

- SQLite 存结构化元数据 + FTS5 全文索引；LanceDB 仅存检索必要字段（id + embedding）
- 搜索策略：LanceDB ANN 搜索 → 获取 chunk_id → SQLite 加载数据 → bge-reranker 重排序
- 向量搜索优先，FTS5 全文索引兜底

### 6.3 同步机制

**全量同步**（首次启动）：

```
扫描 workspace 下所有 .md 文件
  → 计算 SHA256 hash
  → 写入 file_index（sync_status = synced）
  → 解析文件内容，生成 semantic_chunks
  → 向量化并写入 LanceDB
  → 执行语义关联分析
```

**增量同步**（日常运行）：

```
文件变更检测（fs.watch / chokidar）
  → 计算新 hash → 对比 file_index 中记录
  → hash 不一致 → 标记为待处理
  → 对变更文件重新解析
  → 删除旧 semantic_chunks → 重新解析插入
  → 更新 file_index hash 和修改时间
  → 更新 LanceDB 向量
```

**冲突处理**：始终以文件系统为事实来源，索引可随时重建。

---

## 七、核心数据流

### 7.1 Journal 记录流

```
用户编辑 journal/YYYY-MM-DD.md
    │
    ▼（后台自动，文件变更检测触发）
文件变更检测 → 对比 file_index hash
    │
    ▼
AI 语义拆分 → 生成 semantic_chunks
    │
    ▼
向量化（jina-embeddings-v3）→ 存入 LanceDB
    │
    ▼
语义链接（与历史语义块计算相似度）→ 写入 semantic_links
    │
    ▼
概念提取 → 更新 concepts 表 + evolving_summary
    │
    ▼
更新 FTS5 全文索引（semantic_chunks_fts）
    │
    ▼
主题聚类检测（高频概念簇 → 自动创建 Topic）
```

### 7.2 项目创作流

```
用户创建项目，编辑作品元数据 → 系统自动在 projects/ 下创建目录
    │
    ▼
用户创建新页面，设定页面概要内容
    │
    ▼（AI 主动查询）
AI 根据页面概要自动语义检索相关历史语义块
    │
    ▼
用户在检索结果中勾选需要的语义块
    │
    ▼（用户确认后触发 LLM）
LLM 基于页面概要 + 勾选的语义块自动生成初稿
    │
    ▼
用户编辑、调整初稿内容
    │
    ▼（30 秒无编辑后自动触发）
AI 语义拆分 → 向量化（与 Journal 流相同机制）
```

**创作流特点**：

- 不等待保存，而是通过页面概要驱动 AI 主动检索
- 用户从"被动接收推荐"变为"主动勾选引用"——精准控制生成素材
- 30 秒空闲检测：编辑停止后自动执行后台处理，不影响编辑体验

### 7.3 全局搜索流

```
用户输入搜索词（Ctrl+K）
    │
    ├── 1. 向量搜索：LanceDB ANN 搜索 → 获取 chunk_ids → SQLite 加载详情
    │
    ├── 2. FTS5 全文搜索（语义块内容 + AI 摘要）
    │      ├── semantic_chunks_fts（content + ai_summary）
    │      ├── concepts_fts（title + evolving_summary）
    │      ├── topics_fts（title + summary）
    │      ├── projects_fts（name + description + ai_summary）
    │      └── pages_fts（title + ai_summary）
    │
    └── 合并去重 → 按类型分组 → 返回结果
```

---

## 八、关键业务模块

### 8.1 Journal 记录日志

- **块编辑**：行内编辑、Enter 换行、Tab/Shift+Tab 缩进、TODO 状态循环
- **标签/双链**：`#标签` 和 `[[页面]]` 自动补全，写入 Markdown 文件，保存时自动提取并更新 tags 表和 semantic_links 表
- **语义拆分**：AI 根据语义边界自动拆分长文本（>300 字）为多个语义块
- **语义块视觉区分**：鼠标悬浮时呈现卡片轮廓，帮助识别内容分组

### 8.2 Wiki 知识体系

- **概念提取**：从语义块中提取高频概念实体，调用 LLM 生成名称、摘要、演化历史，更新 evolving_summary
- **主题聚类**：高频概念簇自动生成 Topic，卡片列表展示
- **主题管理**：查看详情、编辑名称、软删除、恢复
- **概念网络可视化**：力导向气泡图
- **相似概念合并**：根据语义相似度自动合并相关概念
- **相似主题合并**：根据语义相似度自动合并相关主题

### 8.3 Project 创作

- **项目创建**：基于主题创建项目、自主创建项目
- **分页面编辑**：左侧大纲树 + 中间编辑器 + 右侧 AI 助手面板
- **AI Skills**：续写、润色、改写、语义检索引用
- **页面管理**：新建/重命名/删除/拖拽排序，支持嵌套章节

### 8.4 Reflection 反思流

- 模式发现：热点主题、周期性规律、高频概念
- 趋势分析：兴趣漂移、知识增长、概念演化
- 矛盾检测：观点冲突、目标偏离
- 知识缺口：缺失关联、延伸探索
- 行为洞察：活跃提醒、习惯肯定

---

## 九、非功能性需求

### 9.1 性能指标

| 指标                       | 目标值       |
| :------------------------- | :----------- |
| 块创建到渲染               | ≤ 100ms      |
| 语义拆分（>300 字）        | ≤ 2s         |
| Embedding 生成             | ≤ 500ms / 块 |
| 语义搜索（Top-10）         | ≤ 200ms      |
| 本地 LLM 推理（续写/润色） | ≤ 5s         |
| 应用冷启动                 | ≤ 3s         |

### 9.2 硬件要求

> 详见 [`model.md`](../model/model.md#一硬件配置要求)（硬件配置要求）。

### 9.3 安全与隐私

- 所有数据本地存储，用户完全可控
- API Key 本地加密存储（详见 [`app.md`](../config/app.md)）
- 无云端数据收集，不采集用户隐私

---

## 十、开发环境

| 项目       | 版本/工具   |
| :--------- | :---------- |
| Node.js    | v24.14.1    |
| 包管理     | pnpm        |
| 版本控制   | Git         |
| TypeScript | strict 模式 |
| ESLint     | flat config |

常用命令：

```bash
pnpm install       # 安装依赖
pnpm dev           # 开发服务器（Electron + Vite）
pnpm typecheck     # vue-tsc --noEmit
pnpm lint          # eslint . --fix
pnpm build         # vue-tsc && vite build
pnpm prod          # vite build && electron-builder
pnpm rebuild       # 重编译 better-sqlite3（Node.js 升级后）
```

---

## 附录：参考文档索引

| 文档                                  | 说明                                            |
| :------------------------------------ | :---------------------------------------------- |
| [prd.md](prd.md)                      | 产品功能设计文档                                |
| [mrd.md](mrd.md)                      | 产品战略文档（市场、用户、竞争、需求优先级）    |
| [mvp.md](mvp.md)                      | Phase 1 开发计划（Sprint 规划、风险、成功指标） |
| [refactor.md](refactor.md)            | 重构计划（术语统一、架构清理、迁移步骤）        |
| [model.md](../model/model.md)         | AI 模型方案（硬件配置、模型列表、路由设计）     |
| [storage.md](../storage/storage.md)   | 存储方案总览（文件优先架构、三层数据模型）      |
| [sqlite.md](../storage/sqlite.md)     | SQLite 表结构设计（22 张表）                    |
| [lancedb.md](../storage/lancedb.md)   | LanceDB 向量数据库设计                          |
| [userData.md](../storage/userData.md) | 用户数据目录结构                                |
| [ui-design.md](../ui/ui-design.md)    | UI 概要设计文档                                 |
| [app.md](../config/app.md)            | 应用配置文档                                    |
| [model.md](../config/model.md)        | 模型配置文档（数据结构、API、Store）            |
