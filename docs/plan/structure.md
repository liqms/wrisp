# PenTip 项目结构（v2.0）

> 本文档对齐 [tech.md v5](tech.md)（目标架构），描述改造完成后的完整项目结构。
> 标记 **※** 的文件表示当前代码库中尚不存在，属于待新建的目标文件。
> 最后更新：2026-06-28

---

## 一、总览

```
PenTip/
├── .github/                    # GitHub 模板和规范
├── resources/                  # 资源文件（内置 Skills、Schema）
├── scripts/                    # 构建脚本
├── static/                     # 静态资源（字体、图片、Logo）
├── tests/                      # 测试文件
├── src/                        # 源代码（三大源码根）
│   ├── main/                   #   Electron 主进程
│   ├── renderer/               #   Vue 3 渲染进程
│   └── shared/                 #   主进程/渲染进程共享代码
├── 根级配置文件                 #   Vite、TypeScript、ESLint 等
```

### 五层架构映射

| 层次                | 源码路径                                                              | 核心职责                   |
| :------------------ | :-------------------------------------------------------------------- | :------------------------- |
| **Interface Layer** | `src/renderer/`                                                       | Vue 3 交互界面             |
| **Service Layer**   | `src/main/ipcMain/` + `core/apis/` + `core/services/`                 | IPC → API → Service 调用链 |
| **Cognitive Layer** | `src/main/core/model-gateway/` + `core/smart-tasks/` + `core/skills/` | AI 推理、智能任务、Skills  |
| **Knowledge Layer** | `src/main/core/db/` + `core/vector/`                                  | SQLite（FTS5）+ LanceDB    |
| **Storage Layer**   | 运行期 `journal/` `projects/` 目录                                    | Markdown 文件系统          |

---

## 二、根级配置文件

| 文件                   | 功能                                                                                 |
| :--------------------- | :----------------------------------------------------------------------------------- |
| `package.json`         | 项目元信息、依赖管理、脚本定义（pnpm dev/build/prod 等）                             |
| `pnpm-lock.yaml`       | 依赖锁定文件                                                                         |
| `pnpm-workspace.yaml`  | pnpm 工作空间配置（当前为单包）                                                      |
| `vite.config.ts`       | Vite 构建配置：路径别名 `@/` → `src/`、electron 插件、Sass 全局变量、SQL schema 复制 |
| `vitest.config.ts`     | Vitest 测试运行器配置                                                                |
| `tsconfig.json`        | TypeScript 总配置入口（引用子配置）                                                  |
| `tsconfig.app.json`    | 应用源码 TypeScript 配置（`src/`，strict 模式）                                      |
| `tsconfig.node.json`   | Node.js 环境 TypeScript 配置                                                         |
| `tsconfig.vitest.json` | 测试 TypeScript 配置                                                                 |
| `eslint.config.mjs`    | ESLint 扁平化配置                                                                    |
| `index.html`           | Vite 入口 HTML，挂载 Vue 应用                                                        |
| `.env.example`         | 环境变量示例                                                                         |
| `.gitignore`           | Git 忽略规则                                                                         |
| `AGENTS.md`            | AI Agent 开发指南                                                                    |
| `README.md`            | 项目说明                                                                             |

---

## 三、主进程（`src/main/`）

> Electron 主进程，负责窗口管理、IPC 通信、业务逻辑、AI 推理、数据存储。

### 3.1 目录结构

```
src/main/
├── constants/                  # 常量定义
├── core/                       # 核心业务逻辑
│   ├── apis/                   #   适配层（13 API 模块）
│   ├── db/                     #   数据访问层（20 DAO）
│   ├── migration/              #   数据库/配置迁移
│   ├── model-gateway/          #   模型网关（LLM + 本地）
│   ├── scheduler/              #   定时任务调度
│   ├── services/               #   业务服务层（11 main + 6 base）
│   ├── skills/                 #   AI Skills 引擎
│   ├── smart-tasks/            #   智能任务编排
│   ├── task-queue/             #   后台任务队列
│   └── vector/                 #   向量数据库封装
├── ipcMain/                    # IPC 通道处理（13 个）
├── preload/                    # Preload 脚本
│   ├── listeners/              #   事件监听器
│   ├── modules/                #   预加载模块（13 个，contextBridge）
│   └── types/                  #   Preload 类型定义
├── schemas/                    # SQL Schema + 迁移 SQL
├── types/                      # 主进程类型定义
├── utils/                      # 主进程工具函数
├── index.ts                    # 主进程入口
├── preload.ts                  # Preload 入口（转发到 preload/index.ts）
└── protocol.ts                 # 自定义协议注册
```

### 3.2 `constants/` — 常量定义

| 文件                  | 功能                                                 |
| :-------------------- | :--------------------------------------------------- |
| `config.constants.ts` | 应用配置默认值（electron-store 默认配置）            |
| `model.constants.ts`  | 模型配置默认值、模型相关常量（默认路由、模型元信息） |
| `index.ts`            | 常量聚合导出                                         |

### 3.3 `core/apis/` — API 适配层（15 个）

> 作为 IPC Handler 与 Service/DAO 之间的适配层，统一返回 `ResponseWrapper` 格式。

| API              | 文件                   | 职责                                                |
| :--------------- | :--------------------- | :-------------------------------------------------- |
| `config.api`     | `config.api.ts`        | 配置读写                                            |
| `journal.api`    | `journal.api.ts`       | Journal 块 CRUD                                     |
| `project.api`    | `project.api.ts`       | 项目与页面管理                                      |
| `page.api`       | `page.api.ts`          | 页面 CRUD、排序                                     |
| `ai.api`         | `ai.api.ts`            | AI 任务触发与状态查询，调用 AI Skills，智能任务调度 |
| `model.api`      | `model.api.ts`         | 模型配置、下载管理                                  |
| `tag.api`        | `tag.api.ts`           | 标签管理                                            |
| `concept.api`    | `concept.api.ts` ※     | 概念查询（由 `think.api.ts` 拆分）                  |
| `topic.api`      | `topic.api.ts` ※       | 主题查询（由 `think.api.ts` 拆分）                  |
| `reflection.api` | `reflection.api.ts` ※  | 反思查询（由 `think.api.ts` 拆分）                  |
| `task.api`       | `task.api.ts`          | 后台任务管理                                        |
| `webview.api`    | `webview.api.ts`       | WebView 生命周期                                    |
| `system.api`     | `system.api.ts`        | 系统信息、系统通知、窗口管理、升级                  |
| `logger.api`     | `logger.api.ts`        | 日志记录                                            |
| `search.api`     | `search.api.ts` ※      | 搜索功能                                            |
| —                | `index.ts`             | 聚合导出所有 API 模块                               |

### 3.4 `core/db/` — 数据访问层（DAO）

> 所有 DAO 继承 `BaseDao<T, C, U>`，使用 better-sqlite3 + WAL 模式 + 外键约束。
> 共 21 个 DAO 文件（不含 `base.dao`）。
> `skill-execution.dao.ts` 当前存在于磁盘但未在 `index.ts` 导出，重构时补充到索引。

| DAO                        | 对应表              | 职责                                      |
| :------------------------- | :------------------ | :---------------------------------------- |
| `base.dao.ts`              | —                   | 泛型基类 DAO，封装 CRUD + 分页 + 条件查询 |
| `connection.ts`            | —                   | 数据库连接管理（单例，WAL 模式）          |
| `chunk.dao.ts` ※           | `semantic_chunks`   | 语义块 CRUD、搜索                         |
| `tag.dao.ts`               | `tags`              | 标签定义 CRUD                             |
| `taggedItem.dao.ts`        | `tagged_items`      | 标签-实体多态关联                         |
| `semanticLink.dao.ts`      | `semantic_links`    | 语义链接 CRUD、相似度查询                 |
| `concept.dao.ts`           | `concepts`          | 概念实体 CRUD、搜索、演化摘要更新         |
| `conceptChunk.dao.ts` ※    | `concept_chunks`    | 概念-语义块关联（多对多）                 |
| `topic.dao.ts`             | `topics`            | 主题 CRUD                                 |
| `topicChunk.dao.ts` ※      | `topic_chunks`      | 主题-语义块关联                           |
| `topicConcept.dao.ts`      | `topic_concepts`    | 主题-概念关联                             |
| `temporalEvent.dao.ts`     | `temporal_events`   | 时间事件记录                              |
| `reflection.dao.ts`        | `reflections`       | 反思记录 CRUD                             |
| `reflectionChunk.dao.ts` ※ | `reflection_chunks` | 反思-语义块关联                           |
| `project.dao.ts`           | `projects`          | 创作项目 CRUD                             |
| `projectChunk.dao.ts` ※    | `project_chunks`    | 项目-语义块关联                           |
| `page.dao.ts`              | `pages`             | 项目页面 CRUD、排序                       |
| `migrationDb.dao.ts`       | `migrations_db`     | 数据库迁移版本记录                        |
| `vector.dao.ts`            | LanceDB             | 向量存储访问                              |
| `task.dao.ts`              | `tasks`             | 后台任务定义 CRUD                         |
| `taskExecution.dao.ts`     | `task_executions`   | 任务执行记录                              |
| `skillExecution.dao.ts`    | `skill_executions`  | AI Skills 执行记录（重构时补充到 `index.ts` 导出） |
| —                          | `index.ts`          | 聚合导出所有 DAO                          |

### 3.5 `core/migration/` — 迁移管理

> 注意：`core/migration/schemas/migrations/` 中的迁移文件将在重构时合并到 `src/main/schemas/migrations/`，统一管理。

| 文件/目录               | 职责                           |
| :---------------------- | :----------------------------- |
| `config.migration.ts`   | 应用配置（electron-store）迁移 |
| `model.migration.ts`    | 模型配置（electron-store）迁移 |
| `database.migration.ts` | 数据库 schema 迁移执行器       |
| `schemas/migrations/`   | SQL 迁移文件（→ 见 §3.16）     |
| `index.ts`              | 迁移入口                       |

### 3.6 `core/model-gateway/` — 模型网关

> AI 模型统一网关，管理本地模型和云端 API 的路由、加载、推理。

**`llm-gateway/` — 云端 LLM 网关：**

| 文件/目录                        | 职责                                 |
| :------------------------------- | :----------------------------------- |
| `adapters/base.adapter.ts`       | 适配器基类                           |
| `adapters/claude.adapter.ts`     | Claude API 适配                      |
| `adapters/deepseek.adapter.ts`   | DeepSeek API 适配                    |
| `adapters/local.adapter.ts`      | 本地模型适配（转发到 local-gateway） |
| `adapters/openai.adapter.ts`     | OpenAI 兼容 API 适配                 |
| `adapters/qwen.adapter.ts`       | Qwen API 适配                        |
| `adapters/volcengine.adapter.ts` | 火山引擎 API 适配                    |
| `providers/provider-manager.ts`  | 多 Provider 管理                     |
| `router/failover-handler.ts`     | 故障转移处理                         |
| `router/load-balancer.ts`        | 负载均衡                             |
| `router/model-selector.ts`       | 模型选择器（路由规则）               |
| `utils/cost-tracker.ts`          | 调用成本追踪                         |
| `utils/logger.ts`                | 模型调用日志                         |
| `config.ts`                      | LLM 网关配置                         |
| `types.ts`                       | LLM 网关类型定义                     |
| `index.ts`                       | LLM 网关入口                         |

**`local-gateway/` — 本地模型网关：**

| 文件/目录                     | 职责                                         |
| :---------------------------- | :------------------------------------------- |
| `worker/embedding-handler.ts` | Worker Thread：Embedding 生成                |
| `worker/llm-handler.ts`       | Worker Thread：LLM 推理                      |
| `worker/rerank-handler.ts`    | Worker Thread：重排序                        |
| `worker/index.ts`             | Worker 入口                                  |
| `embeddings.ts`               | Embedding 模型推理封装（jina-embeddings-v3） |
| `gateway.ts`                  | 本地网关主入口                               |
| `hardware.ts`                 | 硬件检测（CPU/GPU/Memory）                   |
| `manager.ts`                  | 模型调度管理                                 |
| `model-manager.ts`            | 模型生命周期管理（下载/加载/卸载）           |
| `model-registry.ts`           | 模型注册表                                   |
| `rerank.ts`                   | 重排序模型推理封装（bge-reranker-v2-m3）     |
| `types.ts`                    | 本地网关类型定义                             |
| `index.ts`                    | 本地网关入口                                 |

**`router.ts`** — 模型路由总入口（云端 vs 本地选择）

### 3.7 `core/scheduler/` — 定时调度

| 文件              | 职责                             |
| :---------------- | :------------------------------- |
| `scheduler.ts`    | 定时任务调度器                   |
| `backup.task.ts`  | 数据备份任务                     |
| `cleanup.task.ts` | 定时清理任务                     |
| `index.ts`        | 调度器入口（当前已注释，未启用） |

### 3.8 `core/services/` — 业务服务层

> 封装业务逻辑，组合多个 DAO 完成复杂操作，供 API 层调用。

**Main Services（13 个）：**

| Service              | 文件                        | 职责                                         |
| :------------------- | :-------------------------- | :------------------------------------------- |
| `ai.service`         | `ai.service.ts`             | AI 任务编排、模型调度                        |
| `journal.service`    | `journal.service.ts` ※      | Journal 块管理、CRUD                         |
| `config.service`     | `config.service.ts`         | 配置管理                                     |
| `model.service`      | `model.service.ts`          | 模型下载/加载/卸载                           |
| `page.service`       | `page.service.ts`           | 页面 CRUD 逻辑                               |
| `project.service`    | `project.service.ts`        | 项目生命周期管理                             |
| `tag.service`        | `tag.service.ts`            | 标签 CRUD 逻辑                               |
| `concept.service`    | `concept.service.ts` ※      | 概念查询逻辑（由 `think.service.ts` 拆分）   |
| `topic.service`      | `topic.service.ts` ※        | 主题查询逻辑（由 `think.service.ts` 拆分）   |
| `reflection.service` | `reflection.service.ts` ※   | 反思查询逻辑（由 `think.service.ts` 拆分）   |
| `webview.service`    | `webview.service.ts`        | WebView 生命周期管理                         |
| `system.service`     | `system.service.ts`         | 系统信息查询、系统通知、窗口管理、升级       |
| `search.service`     | `search.service.ts` ※       | 搜索功能                                     |
| `update.service`     | `update.service.ts` ※       | 应用更新检查、下载、安装（electron-updater） |

**Base Services（8 个，`services/base/`）：**

| Service                  | 文件                          | 职责                                  |
| :----------------------- | :---------------------------- | :------------------------------------ |
| `notification.service`   | `notification.service.ts`     | 系统通知管理                          |
| `cleanup.service`        | `cleanup.service.ts`          | 定时清理任务                          |
| `vector.service`         | `vector.service.ts`           | LanceDB 向量操作封装                  |
| `file.service`           | `file.service.ts` ※           | 文件管理（同步、hash 比对）           |
| `auto.service`           | `auto.service.ts` ※           | 自动任务管理（空闲检测、后台处理）    |
| `download.service`       | `download.service.ts`         | 通用下载管理（模型文件下载）          |
| `backup.service`         | `backup.service.ts` ※         | 用户触发的备份/恢复操作               |
| `workspace-init.service` | `workspace-init.service.ts` ※ | 首次启动工作空间扫描、file_index 构建 |

### 3.9 `core/skills/` — AI Skills 引擎

> Skills 是 AI 可执行的能力模块（续写、润色、翻译等）。

| 文件/目录                     | 职责                       |
| :---------------------------- | :------------------------- |
| `tools/search-blocks.tool.ts` | Skill 工具：语义搜索块     |
| `skill.executor.ts`           | Skill 执行器               |
| `skill.manager.ts`            | Skill 管理器（注册、发现） |
| `skill.schema.validator.ts`   | Skill JSON Schema 校验     |
| `skill.updater.ts`            | Skill 更新器               |
| `tool.registry.ts`            | 工具注册表                 |

### 3.10 `core/smart-tasks/` — 智能任务编排

> AI 后台处理流水线定义（语义拆分 → 摘要 → 概念提取 → 语义链接 → 主题检测）。

| 文件/目录                                 | 职责                           |
| :---------------------------------------- | :----------------------------- |
| `executors/chunk-summary.executor.ts` ※   | 语义块摘要生成                 |
| `executors/chunk-vectorize.executor.ts` ※ | 语义块向量化                   |
| `executors/concept-extract.executor.ts`   | 概念提取                       |
| `executors/semantic-link.executor.ts`     | 语义链接建立                   |
| `executors/topic-detection.executor.ts`   | 主题聚类检测                   |
| `executors/topic-summary.executor.ts`     | 主题摘要生成                   |
| `scheduler.ts`                            | 智能任务调度器                 |
| `task-dag.ts`                             | 任务有向无环图定义（执行顺序） |
| `progress.manager.ts`                     | 进度管理                       |
| `types.ts`                                | 智能任务类型定义               |
| `index.ts`                                | 智能任务入口                   |

### 3.11 `core/task-queue/` — 后台任务队列

| 文件               | 职责                      |
| :----------------- | :------------------------ |
| `task-queue.ts`    | 队列实现（FIFO + 优先级） |
| `task-executor.ts` | 任务执行器                |
| `singleton.ts`     | 全局单例                  |
| `types.ts`         | 队列类型定义              |
| `index.ts`         | 队列入口                  |

### 3.12 `core/vector/` — 向量数据库

| 文件         | 职责                                        |
| :----------- | :------------------------------------------ |
| `lancedb.ts` | LanceDB 连接管理 + CRUD 封装（IVF-PQ 索引） |

### 3.13 `ipcMain/` — IPC 通道处理（15 个）

> 采用 4 层 IPC 模式：`preload module → API → ipcMain handler → Service/DAO`。
> 每个文件通过 `ipcMain.handle` / `ipcMain.on` 注册对应 IPC 域。

| IPC 域     | 文件                  | 职责                                                |
| :--------- | :-------------------- | :-------------------------------------------------- |
| config     | `config.ipc.ts`       | 配置读写                                            |
| journal    | `journal.ipc.ts` ※    | Journal 块 CRUD                                     |
| project    | `project.ipc.ts`      | 项目与页面管理                                      |
| page       | `page.ipc.ts`         | 页面 CRUD、排序                                     |
| ai         | `ai.ipc.ts`           | AI 任务触发与状态查询，调用 AI Skills，智能任务调度 |
| model      | `model.ipc.ts`        | 模型配置、下载管理                                  |
| tag        | `tag.ipc.ts`          | 标签管理                                            |
| concept    | `concept.ipc.ts` ※    | 概念查询（由 `think.ipc.ts` 拆分）                  |
| topic      | `topic.ipc.ts` ※      | 主题查询（由 `think.ipc.ts` 拆分）                  |
| reflection | `reflection.ipc.ts` ※ | 反思查询（由 `think.ipc.ts` 拆分）                  |
| task       | `task.ipc.ts`         | 后台任务管理                                        |
| webview    | `webview.ipc.ts`      | WebView 生命周期                                    |
| system     | `system.ipc.ts`       | 系统信息、系统通知、窗口管理、升级                  |
| logger     | `logger.ipc.ts`       | 日志记录                                            |
| search     | `search.ipc.ts` ※     | 搜索功能                                            |
| —          | `index.ts`            | 聚合注册所有 IPC 通道                               |

### 3.14 `preload/` — Preload 脚本

> 通过 `contextBridge.exposeInMainWorld` 将主进程 API 暴露给渲染进程。

**`modules/` — 预加载模块（15 个，对应 IPC 域）：**

| 模块文件         | 暴露命名空间                  | 职责                               |
| :--------------- | :---------------------------- | :--------------------------------- |
| `config.ts`      | `window.pentip.config`        | 配置读写                           |
| `journal.ts` ※   | `window.pentip.journal`       | Journal CRUD                       |
| `project.ts`     | `window.pentip.project`       | 项目管理                           |
| `page.ts`        | `window.pentip.page`          | 页面管理                           |
| `ai.ts`          | `window.pentip.ai`            | AI 任务、Skills                    |
| `model.ts`       | `window.pentip.model`         | 模型管理                           |
| `tag.ts`         | `window.pentip.tag`           | 标签管理                           |
| `concept.ts` ※   | `window.pentip.concept`       | 概念查询（由 `think.ts` 拆分）     |
| `topic.ts` ※     | `window.pentip.topic`         | 主题查询（由 `think.ts` 拆分）     |
| `reflection.ts` ※ | `window.pentip.reflection`   | 反思查询（由 `think.ts` 拆分）     |
| `task.ts`        | `window.pentip.task`          | 任务管理                           |
| `webview.ts`     | `window.pentip.webview`       | WebView 管理                       |
| `system.ts`      | `window.pentip.system`        | 系统信息                           |
| `logger.ts`      | `window.pentip.logger`        | 日志记录                           |
| `search.ts` ※    | `window.pentip.search`        | 搜索功能                           |
| `index.ts`       | 聚合导出                      | 统一注册所有模块                   |

**`types/` — Preload 类型定义：**

> 每个模块对应一个 `.ts` 文件，定义 `window.pentip.xxx` 的接口类型。文件名与 `modules/` 一一对应。

**`listeners/` — 事件监听器：**

| 文件              | 职责                                  |
| :---------------- | :------------------------------------ |
| `download.ts`     | 下载进度事件监听（主进程 → 渲染进程） |
| `notification.ts` | 通知事件监听（主进程 → 渲染进程）     |

**`index.ts`** — Preload 入口，初始化所有模块。

### 3.15 主进程其他文件

| 文件          | 职责                                                 |
| :------------ | :--------------------------------------------------- |
| `index.ts`    | 主进程入口：加载 env、创建窗口、数据库迁移、注册 IPC |
| `preload.ts`  | Preload 入口（转发到 `preload/index.ts`）            |
| `protocol.ts` | 自定义协议注册（`pentip://`）                        |

### 3.16 `schemas/` — SQL Schema

| 文件/目录                                     | 职责                           |
| :-------------------------------------------- | :----------------------------- |
| `init.sql`                                    | 数据库初始建表 SQL（22 张表）  |
| `migrations/`                                 | Schema 迁移 SQL 文件（所有迁移统一存放于此） |
| `migrations/1.0.1_add_smart_task_tables.sql`  | 新增 smart task 表（从 `core/migration/schemas/migrations/` 移入） |
| `migrations/1.1.1_add_blocks_is_memo.sql`     | blocks 表新增 `is_memo` 列     |
| `migrations/1.1.2_add_blocks_is_archived.sql` | blocks 表新增 `is_archived` 列 |
| `migrations/1.1.3_update_topics_status.sql`   | topics 表更新 `status`         |
| `migrations/1.1.4_add_projects_status.sql`    | projects 表新增 `status`       |

### 3.17 `types/` — 主进程类型定义

| 子目录/文件          | 职责                                                                                 |
| :------------------- | :----------------------------------------------------------------------------------- |
| `db/`                | 数据库实体类型（对应 DAO）：chunk、concept、page、project、reflection、tag、topic 等 |
| `download.types.ts`  | 下载进度类型                                                                         |
| `http.types.ts`      | HTTP 响应类型                                                                        |
| `migration.types.ts` | 迁移相关类型                                                                         |
| `model.type.ts`      | 模型配置类型                                                                         |

### 3.18 `utils/` — 主进程工具函数

| 文件          | 职责                             |
| :------------ | :------------------------------- |
| `crypto.ts`   | 加密工具（API Key 本地加密存储） |
| `error.ts`    | 错误处理（当前为空占位）         |
| `http.ts`     | HTTP 客户端封装                  |
| `i18n.ts`     | 主进程国际化                     |
| `logger.ts`   | 日志工具                         |
| `response.ts` | ResponseWrapper 统一返回格式     |
| `version.ts`  | 版本工具                         |
| `index.ts`    | 聚合导出                         |

---

## 四、渲染进程（`src/renderer/`）

> Vue 3 应用，Naive UI + Pinia + Vue Router + Vue I18n。

### 4.1 目录结构

```
src/renderer/
├── components/                  # 组件
│   ├── base/                   #   基础通用组件
│   ├── editor/                 #   编辑器组件（Tiptap）
│   └── settings/               #   设置页组件
├── composables/                # Composables（Vue 组合式函数）
├── layouts/                    # 布局组件
├── plugins/                    # 插件注册
├── router/                     # Vue Router 路由（4 个）
├── store/                      # Pinia 状态管理（11 个）
├── styles/                     # SCSS 样式
├── types/                      # 渲染进程类型
├── utils/                      # 渲染进程工具
├── views/                      # 页面视图
├── App.vue                     # 应用根组件
├── main.ts                     # 渲染进程入口
```

### 4.2 `components/` — 组件

#### 全局公共组件

| 组件                  | 文件                      | 职责                                      |
| :-------------------- | :------------------------ | :---------------------------------------- |
| **GlobalSearch**      | `GlobalSearch.vue` ※      | 全局搜索入口（Ctrl+K），任意页面触发      |
| **NotificationToast** | `NotificationToast.vue` | 通知组件（由 `NotificationHandler.vue` 重命名） |
| **UpdatePrompt**      | `UpdatePrompt.vue` ※      | 更新记录组件，检查应用版本更新            |
| **WebViewContainer**  | `WebViewContainer.vue` | WebView 容器（由 `WebView.vue` 重命名） |
| **AppHeader**         | `AppHeader.vue`           | 应用标题栏（窗口控制）                    |
| **SettingsView**      | `SettingsView.vue`        | 设置弹窗（modal 形式，非路由）            |

#### Markdown 编辑器组件（`editor/`）

> 以下组件来自重构前的代码：`NewBlockCreator.vue`、`TiptapToolbar.vue` 已清理；
> `SemanticBlockItem.vue` 重命名为 `SemanticBlock.vue`；
> `SemanticGroup.ts` 接口定义保留。

| 文件/目录                  | 职责                                                |
| :------------------------- | :-------------------------------------------------- |
| `TiptapEditor.vue`         | 通用编辑器组件（Journal / Project 共用）            |
| `BlockEditor.vue` ※        | Journal 块编辑器：行内编辑、TODO 状态循环、拖拽手柄 |
| `ContextMenu.vue` ※        | 右键菜单组件                                        |
| `SemanticBlock.vue`        | 语义块视觉分区组件（由 `SemanticBlockItem.vue` 重命名） |
| `SemanticGroup.ts`         | 语义分组接口定义（保留）                            |
| `SlashMenu.vue`            | 斜杠菜单组件（`/` 触发）                            |
| `extensions.ts`            | Tiptap 扩展配置                                     |
| `EditorQuickActions.vue` ※ | 编辑器快捷操作（AI 续写/润色等）                    |

#### 基础组件（`base/`）

| 文件                        | 职责         |
| :-------------------------- | :----------- |
| `ColorCard.vue`             | 色彩卡片展示 |
| `DownloadButton.vue`        | 下载按钮     |
| `DownloadProgressPanel.vue` | 下载进度面板 |
| `FeatureCard.vue`           | 功能卡片     |
| `FunctionCard.vue`          | 函数卡片（由顶层组件移入） |
| `Test.vue`                  | 测试组件     |

#### 视图专用组件（`views/`——挂载于各视图内）

| 文件                     | 父视图      | 职责                                          |
| :----------------------- | :---------- | :-------------------------------------------- |
| `ConceptGraph.vue` ※     | WikiView    | 概念网络气泡图（力导向图可视化）              |
| `TopicList.vue` ※        | WikiView    | 主题聚类卡片列表 + 排序/筛选                  |
| `ProjectList.vue` ※      | ProjectView | 项目列表/卡片视图                             |
| `CatalogTree.vue` ※      | ProjectView | 页面目录树（嵌套章节、悬浮大纲面板）          |
| `AiAssistantPanel.vue` ※ | ProjectView | 右侧 AI 上下文面板（关联召回、续写/润色按钮） |

#### 设置页组件（`settings/`）

| 文件                   | 职责                                               |
| :--------------------- | :------------------------------------------------- |
| `GeneralSettings.vue`  | 通用设置（语言、主题、快捷键）                     |
| `ModelSettings.vue`    | 模型管理页面（含智能模式切换、模型路由优先级配置） |
| `ModelItem.vue`        | 模型配置项                                         |
| `ModelDefault.vue`     | 默认模型选择                                       |
| `AddProviderModal.vue` | 添加 AI Provider 弹窗                              |
| `ProviderItem.vue`     | Provider 配置项                                    |
| `KeymapSettings.vue`   | 快捷键设置                                         |
| `DataManagement.vue` ※ | 数据管理：工作空间路径切换、备份与恢复             |

### 4.3 `composables/` — 组合式函数

| 文件                 | 职责                                          |
| :------------------- | :-------------------------------------------- |
| `useJournal.ts` ※    | Journal API 封装（对应 preload journal 模块） |
| `useProject.ts`      | 项目操作封装                                  |
| `useWiki.ts` ※       | Wiki 知识体系封装（聚合 concept/topic/reflection IPC 调用）            |
| `useConfig.ts`       | 配置读写封装                                  |
| `useModel.ts`        | 模型管理封装                                  |
| `useTag.ts`          | 标签操作封装                                  |
| `useSystem.ts`       | 系统信息封装                                  |
| `useWebView.ts`      | WebView 管理封装                              |
| `useTheme.ts`        | 主题切换封装                                  |
| `useNotification.ts` | 通知管理封装                                  |
| `useSearch.ts` ※     | 搜索功能封装（全局搜索调用）                  |
| `useAIStream.ts`     | AI 流式响应处理                               |
| `index.ts`           | 聚合导出                                      |

### 4.4 `layouts/` — 布局

| 文件             | 职责                                                   |
| :--------------- | :----------------------------------------------------- |
| `MenuLayout.vue` | 侧边栏 + 主内容区布局，导航：Journal / Wiki / Projects |

### 4.5 `plugins/` — 插件

| 文件          | 职责                  |
| :------------ | :-------------------- |
| `i18n.ts`     | Vue I18n 初始化       |
| `naive-ui.ts` | Naive UI 组件按需注册 |

### 4.6 `router/` — 路由

| 文件       | 职责                                                                |
| :--------- | :------------------------------------------------------------------ |
| `index.ts` | Vue Router 配置（Hash History，4 个路由，全部嵌套在 MenuLayout 下） |

**路由表：**

| 路径        | 视图组件            | 说明                               |
| :---------- | :------------------ | :--------------------------------- |
| `/welcome`  | `Welcome.vue`       | 首次启动欢迎页 / 引导配置          |
| `/journal`  | `JournalView.vue` ※ | Journal 每日日志页，块编辑入口     |
| `/wiki`     | `WikiView.vue` ※    | AI 知识体系（概念网络 + 主题聚类） |
| `/projects` | `ProjectView.vue`   | 创作项目管理 + 编辑器              |

### 4.7 `store/` — Pinia 状态管理（11 个）

| Store          | 文件                    | 职责                                                   |
| :------------- | :---------------------- | :----------------------------------------------------- |
| `ai`           | `ai.store.ts` ※         | AI 智能层：Skills（技能）、Agent（规划）、Chat（对话） |
| `journal`      | `journal.store.ts` ※    | Journal 捕获流状态、块编辑状态                         |
| `project`      | `project.store.ts`      | 创作项目、页面管理状态                                 |
| `wiki`         | `wiki.store.ts` ※       | Wiki 知识体系（聚合 concept/topic/reflection 数据）   |
| `config`       | `config.store.ts`       | 应用配置（通用设置）                                   |
| `model`        | `model.store.ts`        | AI 模型配置、下载状态                                  |
| `download`     | `download.store.ts`     | 模型下载进度管理                                       |
| `tag`          | `tag.store.ts`          | 标签管理                                               |
| `system`       | `system.store.ts`       | 系统信息                                               |
| `webview`      | `webview.store.ts`      | WebView 会话管理                                       |
| `notification` | `notification.store.ts` | 通知管理                                               |
| —              | `index.ts`              | 聚合导出                                               |

### 4.8 `styles/` — 样式

| 文件              | 职责                                       |
| :---------------- | :----------------------------------------- |
| `_fonts.scss`     | 字体引入（Inter、NotoSansSC、SourceSans3） |
| `_markdown.scss`  | Markdown 内容渲染样式                      |
| `_variables.scss` | SCSS 变量定义                              |
| `global.scss`     | 全局样式                                   |
| `themes.scss`     | 主题样式（亮/暗）                          |

### 4.9 `types/` — 渲染进程类型

| 文件            | 职责                         |
| :-------------- | :--------------------------- |
| `electron.d.ts` | `window.pentip` 类型声明扩展 |
| `vite-env.d.ts` | Vite 环境类型                |
| `index.ts`      | 聚合导出                     |

### 4.10 `utils/` — 渲染进程工具

| 文件                    | 职责                    |
| :---------------------- | :---------------------- |
| `crypto.utils.ts`       | 前端加密工具            |
| `electron-listeners.ts` | Electron 事件监听器注册 |
| `error.utils.ts`        | 前端错误处理            |
| `logger.utils.ts`       | 前端日志工具            |
| `string.utils.ts`       | 字符串处理工具          |

### 4.11 `views/` — 页面视图

| 文件                | 职责                                                                                                                                                            |
| :------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Welcome.vue`       | 首次启动欢迎页 / 引导流程：工作空间选择 → 模型下载 → API 配置（内含 WelcomeWorkspaceStep ※ / WelcomeModelDownloadStep ※ / WelcomeApiConfigStep ※ 向导步骤组件） |
| `JournalView.vue` ※ | Journal 每日日志页，内含 BlockEditor 行内编辑 + SemanticBlock 语义分区 + 标签/双链自动补全                                                                      |
| `WikiView.vue` ※    | Wiki 知识体系：内含 ConceptGraph 概念气泡图（concept 数据源）+ TopicList 主题聚类（topic 数据源）+ 反思时间线（reflection 数据源） |
| `ProjectView.vue`   | 创作工作台：内含 ProjectList 项目列表 + OutlineTree 页面大纲树 + AiAssistantPanel AI 助手面板                                                                   |

### 4.12 渲染进程入口

| 文件      | 职责                                                               |
| :-------- | :----------------------------------------------------------------- |
| `App.vue` | 应用根组件，挂载全局组件 + 路由出口                                |
| `main.ts` | 渲染进程入口：创建 Vue 应用、安装 Pinia → Router → Naive UI → i18n |

---

## 五、共享代码（`src/shared/`）

> 主进程和渲染进程共享的枚举、类型、工具函数、国际化资源。

### 5.1 目录结构

```
src/shared/
├── enums/                      # 枚举常量（10 个）
├── i18n/                       # 国际化资源（中/英）
├── types/                      # 共享类型（17 个）
├── utils/                      # 共享工具函数（5 个）
```

### 5.2 `enums/` — 枚举常量

> 使用 `export const X = { ... } as const` + `type X = (typeof X)[keyof typeof X]` 模式。

| 文件                  | 职责                                 |
| :-------------------- | :----------------------------------- |
| `ai.enums.ts`         | AI 相关枚举（任务类型、模型角色等）  |
| `journal.enums.ts` ※  | Journal 枚举（块状态、语义块类型等） |
| `config.enums.ts`     | 配置枚举                             |
| `errorCode.enums.ts`  | 错误码枚举                           |
| `log.enums.ts`        | 日志级别枚举                         |
| `project.enums.ts`    | 项目类型枚举                         |
| `provider.enums.ts`   | AI Provider 枚举                     |
| `task.enums.ts`       | 任务状态枚举                         |
| `themeColor.enums.ts` | 主题色枚举                           |
| `user.enums.ts`       | 用户相关枚举                         |
| `index.ts`            | 聚合导出                             |

### 5.3 `i18n/` — 国际化

| 文件/目录         | 职责          |
| :---------------- | :------------ |
| `locales/enUS.ts` | 英文语言包    |
| `locales/zhCN.ts` | 中文语言包    |
| `types.ts`        | i18n 类型定义 |

### 5.4 `types/` — 共享类型

| 文件                        | 职责                                          |
| :-------------------------- | :-------------------------------------------- |
| `api.types.ts`              | API 请求/响应通用类型                         |
| `base.types.ts`             | 基础类型（分页、排序等）                      |
| `journal.types.ts` ※        | Journal 相关类型（块、语义块）                |
| `config.types.ts`           | 配置相关类型                                  |
| `concept.types.ts` ※        | 概念查询参数与返回结构（由 `think` 拆分）     |
| `topic.types.ts` ※          | 主题查询参数与返回结构（由 `think` 拆分）     |
| `reflection.types.ts` ※     | 反思查询参数与返回结构（由 `think` 拆分）     |
| `llm.types.ts`              | LLM 调用相关类型                              |
| `menu.types.ts`             | 菜单相关类型                                  |
| `model.types.ts`            | 模型相关类型                                  |
| `notification.types.ts`     | 通知相关类型                                  |
| `skill.types.ts`            | Skill 相关类型                                |
| `system.types.ts`           | 系统信息类型                                  |
| `tag.types.ts`              | 标签相关类型（从 `@/main/types/db/` 移入）    |
| `task.types.ts`             | 任务相关类型                                  |
| `webview.types.ts`          | WebView 相关类型                              |
| `search.types.ts` ※         | 搜索相关类型（搜索参数、结果分组、FTS5 高亮） |
| `index.ts`                  | 聚合导出                                      |

### 5.5 `utils/` — 共享工具函数

| 文件            | 职责                           |
| :-------------- | :----------------------------- |
| `id.ts`         | ID 生成器（nanoid）            |
| `object.ts`     | 对象操作工具（深拷贝、合并等） |
| `pagination.ts` | 分页计算工具                   |
| `time.ts`       | 时间格式化工具                 |
| `validate.ts`   | 数据校验工具                   |
| `index.ts`      | 聚合导出                       |

---

## 六、资源文件（`resources/`）

```
resources/
├── schemas/
│   └── skill.schema.json       # AI Skill JSON Schema 定义
└── skills/
    └── built-in/               # 内置 AI Skills（11 个）
        ├── continue.skill.json      # AI 续写
        ├── expand.skill.json        # AI 扩写
        ├── grammar.skill.json       # 语法检查
        ├── keywords.skill.json      # 关键词提取
        ├── outline.skill.json       # 大纲生成
        ├── polish.skill.json        # AI 润色
        ├── rewrite.skill.json       # AI 改写
        ├── sentiment.skill.json     # 情感分析
        ├── summarize.skill.json     # 摘要生成
        ├── tone.skill.json          # 语气调整
        └── translate.skill.json     # 翻译
```

---

## 七、静态资源（`static/`）

```
static/
├── avatars/
│   └── default.png             # 默认头像
├── fonts/                      # 内置字体
│   ├── Inter-*.ttf             # 英文字体（可变字体）
│   ├── NotoSansSC-*.ttf        # 中文字体
│   └── SourceSans3-*.ttf       # 衬线字体
├── images/                     # 图片素材
│   ├── default_*.jpg/png       # 欢迎页插图、作品封面
│   ├── audio_*.jpg             # 音频专辑封面
│   ├── manga_*.jpg             # 漫画示例图
│   └── novel_*.jpg             # 小说示例图
├── logos/                      # 第三方服务 Logo
│   ├── deepseek.png
│   ├── doubao.png
│   └── volcengine.png
├── pentip.icns                 # macOS 应用图标
├── pentip.ico                  # Windows 应用图标
└── pentip.png                  # 应用图标（通用格式）
```

---

## 八、测试（`tests/`）

```
tests/
├── integration/
│   └── main/                   # 主进程集成测试
│       ├── project.dao.test.ts
│       └── tag.dao.test.ts
├── unit/
│   ├── main/                   # 主进程单元测试
│   │   └── config.api.test.ts
│   ├── renderer/               # 渲染进程单元测试
│   │   ├── config.store.test.ts
│   │   ├── notification.store.test.ts
│   │   └── useTheme.test.ts
│   └── shared/                 # 共享代码单元测试
│       ├── locale-keys.test.ts
│       ├── object.test.ts
│       ├── pagination.test.ts
│       ├── time.test.ts
│       └── validate.test.ts
└── setup/
    └── renderer.ts             # 渲染进程测试 setup
```

---

## 九、构建脚本和模板

### `scripts/`

| 文件             | 职责                                               |
| :--------------- | :------------------------------------------------- |
| `dev.js`         | 开发服务器启动脚本（自动清理端口 5173，启动 Vite） |
| `debug_dist.mjs` | 调试构建产物脚本                                   |

### `.github/`

| 文件/目录                                  | 职责                           |
| :----------------------------------------- | :----------------------------- |
| `instructions/dao-pattern.instructions.md` | DAO 模式开发规范               |
| `instructions/ipc-channel.instructions.md` | IPC 4 层模式开发规范           |
| `prompts/add-ipc-channel.prompt.md`        | 添加 IPC 通道的 AI Prompt 模板 |

---

## 十、数据目录结构（运行期）

> 详细说明见 [userData.md](../storage/userData.md)。

```
{workspace}/                     # 用户指定的工作空间
├── journal/                     # Journal 每日日志文件
│   └── YYYY-MM-DD.md           # 按日期命名的 Markdown 文件（保存时自动提取标签/双链）
├── projects/                    # 创作项目目录
│   └── {project-name}/         # 项目文件夹
│       ├── index.md
│       └── *.md                 # 章节页面文件
├── sqlite/
│   └── main.db                 # SQLite 数据库（WAL 模式 + FTS5 全文索引）
└── vectors/
    └── *.lance                  # LanceDB 向量数据（IVF-PQ 索引）

{userData}/                      # Electron 用户数据目录
└── config/
    └── app.json                 # electron-store 配置文件（API Key 加密存储）
```

---

## 附录：重构进度对照

> 标记 **※** 的文件对应 tech.md 目标架构中待新建的文件。
> 完整重构步骤详见 [refactor.md](refactor.md)。

| 区域            | 待新建文件（※）                                                                                                                                                                                                                                                                                                                                                                               | 涉及章节         |
| :-------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- |
| **API**         | `search.api.ts`, `concept.api.ts`, `topic.api.ts`, `reflection.api.ts`                                                                                                                                                                                                                                                                                             | 3.3 Core APIs    |
| **IPC**         | `journal.ipc.ts`, `concept.ipc.ts`, `topic.ipc.ts`, `reflection.ipc.ts`, `search.ipc.ts`                                                                                                                                                                                                                                                                          | 3.13 IPC Handler |
| **Preload**     | `journal.ts`, `concept.ts`, `topic.ts`, `reflection.ts`, `search.ts`                                                                                                                                                                                                                                                                                              | 3.14 Preload     |
| **Services**    | `journal.service.ts`, `concept.service.ts`, `topic.service.ts`, `reflection.service.ts`, `search.service.ts`, `update.service.ts`, `file.service.ts`, `auto.service.ts`, `backup.service.ts`, `workspace-init.service.ts`                                                                                                                                          | 3.8 Services     |
| **DAO**         | `chunk.dao.ts`, `conceptChunk.dao.ts`, `topicChunk.dao.ts`, `reflectionChunk.dao.ts`, `projectChunk.dao.ts`                                                                                                                                                                                                                                                       | 3.4 DAO          |
| **Store**       | `ai.store.ts`, `journal.store.ts`, `wiki.store.ts`                                                                                                                                                                                                                                                                                                                | 4.7 Pinia        |
| **Composables** | `useJournal.ts`, `useWiki.ts`, `useSearch.ts`                                                                                                                                                                                                                                                                                                                     | 4.3 Composables  |
| **Views**       | `JournalView.vue`, `WikiView.vue`                                                                                                                                                                                                                                                                                                                                 | 4.11 Views       |
| **Components**  | `GlobalSearch.vue`, `UpdatePrompt.vue`, `ContextMenu.vue`, `BlockEditor.vue`, `EditorQuickActions.vue`, `ConceptGraph.vue`, `TopicList.vue`, `ProjectList.vue`, `OutlineTree.vue`, `AiAssistantPanel.vue`, `DataManagement.vue`, `WelcomeWorkspaceStep.vue`, `WelcomeModelDownloadStep.vue`, `WelcomeApiConfigStep.vue`                                            | 4.2 Components   |
| **Enums**       | `journal.enums.ts`                                                                                                                                                                                                                                                                                                                                                | 5.2 Enums        |
| **Types**       | `journal.types.ts`, `concept.types.ts`, `topic.types.ts`, `reflection.types.ts`, `tag.types.ts`, `search.types.ts`                                                                                                                                                                                                                                                | 5.4 Shared Types |
| **Smart Tasks** | `chunk-summary.executor.ts`, `chunk-vectorize.executor.ts`                                                                                                                                                                                                                                                                                                        | 3.10 Smart Tasks |
