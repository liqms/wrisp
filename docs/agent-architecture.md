# Wrisp 智能体架构说明

> 本文档描述 Wrisp 项目中智能体相关子系统的实现逻辑，涵盖 Skills（技能）、Smart Tasks（智能任务）、Task Queue（持久化任务队列）、Model Gateway（模型网关）、Scheduler（定时调度）五大子系统的职责、数据结构、调用链路与协作关系。

## 架构总览

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Renderer (Vue 3)                                │
│  SettingsView / SlashMenu / SmartTaskPanel                                │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │ contextBridge (window.electronAPI)
┌────────────────────────────▼─────────────────────────────────────────────┐
│                          Preload (20 modules)                            │
│  skill / smart-task / task / ai / model / ...                             │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │ ipcRenderer.invoke
┌────────────────────────────▼─────────────────────────────────────────────┐
│                          ipcMain (20 handlers)                           │
│  skill.ipc / smart-task.ipc / task.ipc / ai.ipc / model.ipc / ...         │
└──────────┬────────────┬──────────────┬──────────────┬───────────────────┘
           │            │              │              │
     ┌─────▼─────┐ ┌────▼─────┐ ┌─────▼──────┐ ┌────▼──────┐
     │  Skills   │ │SmartTasks│ │ TaskQueue  │ │ModelGW    │
     │ Subsystem │ │Subsystem │ │ Subsystem  │ │ Subsystem  │
     └─────┬─────┘ └────┬─────┘ └─────┬──────┘ └────┬──────┘
           │            │              │              │
           └────────────┴──────────────┴──────────────┘
                                    │
                          ┌─────────▼─────────┐
                          │  LLMGateway /     │
                          │  LocalGateway     │
                          │  Router → Adapters│
                          └───────────────────┘
```

---

## 1. Skills 子系统（技能系统）

> 目录：`src/main/core/skills/`

### 1.1 职责

Skills 是面向用户的"智能体能力"单元。每个 Skill 定义了 prompt 模板、输入参数、可选工具集和预处理/后处理规则，用户通过 slash command 或设置页触发，由 `SkillExecutor` 根据 L1/L2 模型分发执行。

### 1.2 核心文件

| 文件 | 职责 |
|---|---|
| [skill.manager.ts](file:///d:/Code/Github/Wrisp/src/main/core/skills/skill.manager.ts) | 单例，管理 skill 目录初始化、本地/远程 skill 加载、manifest 维护 |
| [skill.executor.ts](file:///d:/Code/Github/Wrisp/src/main/core/skills/skill.executor.ts) | 技能执行核心：L1 单轮 / L2 ReAct 多轮分发 |
| [skill.schema.validator.ts](file:///d:/Code/Github/Wrisp/src/main/core/skills/skill.schema.validator.ts) | Ajv schema 校验，非合规 skill warn+skip |
| [skill.updater.ts](file:///d:/Code/Github/Wrisp/src/main/core/skills/skill.updater.ts) | 远程 skill 更新（diff manifest → 下载 → SHA256 校验） |
| [tool.registry.ts](file:///d:/Code/Github/Wrisp/src/main/core/skills/tool.registry.ts) | 工具注册表，管理 L2 技能可调用的工具 |
| [tools/search-blocks.tool.ts](file:///d:/Code/Github/Wrisp/src/main/core/skills/tools/search-blocks.tool.ts) | 内置工具：搜索语义块 |

### 1.3 SkillDefinition 数据结构

定义在 [skill.types.ts](file:///d:/Code/Github/Wrisp/src/shared/types/skill.types.ts#L119-L157)：

```typescript
interface SkillDefinition {
  id: string;
  name: LocalizedText;          // 双语 {zh, en}
  description: LocalizedText;
  icon: string;
  version: string;
  author: string;
  category: string[];
  tags?: LocalizedText[];
  enabled: boolean;
  taskType?: TaskType;          // 关联创作类型（路由层使用）
  promptTemplate: LocalizedText; // {{变量名}} 插值
  systemPrompt?: LocalizedText;
  input?: SkillInputSchema;     // JSON Schema 格式参数定义
  output?: SkillOutputSchema;
  tools?: SkillToolDefinition[]; // L2 工具定义
  maxSteps?: number;            // L2 最大轮数（默认 5）
  temperature?: number;
  preProcess?: SkillPreProcess[];
  postProcess?: SkillPostProcess;
  example?: SkillExample;       // 双语示例
}
```

**双语机制**：`name`/`description`/`promptTemplate`/`systemPrompt` 为 `LocalizedText`（`{zh, en}`），`tags` 为 `LocalizedText[]`。执行时由 `configService.getValue("general.locale")` 判断语言。旧格式（纯 string）由 `normalizeSkillDefinition` 自动规范化。

### 1.4 L1/L2 执行模型

[skill.executor.ts](file:///d:/Code/Github/Wrisp/src/main/core/skills/skill.executor.ts#L27-L53)：

```
SkillExecutor.execute(skillId, inputs)
  ├─ 无 tools → executeL1()
  │    ├─ validateInputs (JSON Schema)
  │    ├─ renderPrompt ({{变量}} 插值)
  │    ├─ applyPreProcess (trim/stripHtml/extractSelection)
  │    ├─ 构造 LLMRequest { messages, outputType: TEXT, taskType }
  │    ├─ aiService.chatCompletion(request)
  │    └─ applyPostProcess → 返回 SkillExecuteResult
  │
  └─ 有 tools → enqueueL2() (信号量 MAX_CONCURRENT_L2=1)
       └─ executeL2()
            ├─ ReAct 循环 (maxSteps 轮)
            │   ├─ aiService.chatCompletion(request + tools)
            │   ├─ 有 toolCalls → toolRegistry.execute() → 结果加入 messages
            │   └─ 无 toolCalls → 结束
            └─ 返回 SkillExecuteResult { level: "L2", steps }
```

**L2 并发控制**：`MAX_CONCURRENT_L2 = 1`，通过信号量 + 队列排队，避免 L2 多轮工具调用耗尽资源。

### 1.5 工具注册机制

[tool.registry.ts](file:///d:/Code/Github/Wrisp/src/main/core/skills/tool.registry.ts)：

- `ToolRegistry` 单例，`Map<string, RegisteredTool>` 存储。
- 内置工具在构造函数中 `registerBuiltInTools()` 注册（当前仅 `search-blocks`）。
- `RegisteredTool` 含 `permission: "read" | "write"` 权限标识。
- `resolveTools(toolDefs)`：根据 skill 的 tools 定义过滤出已注册工具。
- `getToolsForLLM(toolDefs)`：生成 OpenAI 兼容的 tools 数组传给 LLM。

### 1.6 Skill 资源文件

- **内置 skill**：打包在 `resources/skills/*.json`（dev 读 `app.getAppPath()/resources`，prod 读 `__dirname/../resources`）。
- **远程 skill**：GitHub raw 同步，写入 `<workspace>/resources/skills/`，通过 `RESOURCE_TYPE.SKILL` 纳入资源同步。
- **自定义 skill**：用户创建，存储位置同远程 skill。
- **manifest**：`SkillManifestV2` 结构，记录每个 skill 的 `id/path/source/hash/version/installedAt`。

### 1.7 IPC 通道

[skill.ipc.ts](file:///d:/Code/Github/Wrisp/src/main/ipcMain/skill.ipc.ts)：

| 通道 | 用途 |
|---|---|
| `skill:getSkills` | 获取 skill 列表（按语言解析后返回 SkillListItem[]） |
| `skill:execute` | 执行指定 skill |
| `skill:createCustomSkill` | 创建自定义 skill |
| `skill:toggleSkill` | 启用/禁用 skill |
| `skill:checkUpdates` | 检查远程更新 |
| `skill:updateSkill` | 更新单个 skill |

---

## 2. Smart Tasks 子系统（智能任务）

> 目录：`src/main/core/smart-tasks/`

### 2.1 职责

Smart Tasks 是面向文档内容的"后台智能处理"流水线。用户对文档执行智能分析时，`SmartTaskScheduler` 按 DAG 依赖顺序执行 6 个任务，对文档块进行摘要、向量化、概念提取、主题检测等。

### 2.2 DAG 定义

[task-dag.ts](file:///d:/Code/Github/Wrisp/src/main/core/smart-tasks/task-dag.ts)：

```
第 0 层（无依赖，可并行）：
  chunk-summary     → Block 摘要生成
  chunk-vectorize   → Chunk 向量化

第 1 层：
  semantic-link     → 语义链接生成（依赖 chunk-vectorize）

第 2 层：
  concept-extract   → 概念提取（依赖 chunk-summary + chunk-vectorize）

第 3 层：
  topic-detection   → 主题检测与聚类（依赖 concept-extract）

第 4 层：
  topic-summary     → 主题摘要生成（依赖 topic-detection）
```

### 2.3 核心文件

| 文件 | 职责 |
|---|---|
| [scheduler.ts](file:///d:/Code/Github/Wrisp/src/main/core/smart-tasks/scheduler.ts) | `SmartTaskScheduler` 单例，DAG 调度、状态管理、暂停/取消 |
| [task-dag.ts](file:///d:/Code/Github/Wrisp/src/main/core/smart-tasks/task-dag.ts) | DAG 节点定义与拓扑排序 |
| [progress.manager.ts](file:///d:/Code/Github/Wrisp/src/main/core/smart-tasks/progress.manager.ts) | 执行进度跟踪 |
| [executors/](file:///d:/Code/Github/Wrisp/src/main/core/smart-tasks/executors) | 6 个执行器实现 |

### 2.4 执行流程

[scheduler.ts](file:///d:/Code/Github/Wrisp/src/main/core/smart-tasks/scheduler.ts#L61-L138)：

```
execute(documentId, options)
  ├─ 创建 TaskExecution 记录（TaskExecutionDao）
  ├─ progressManager 注册进度
  ├─ 按 TASK_EXECUTION_ORDER 遍历
  │   ├─ 检查 cancelSignal / pauseSignal
  │   ├─ 检查依赖任务是否已完成
  │   ├─ executor.execute(context)
  │   └─ 更新进度
  └─ 记录最终状态（completed/failed/cancelled）
```

### 2.5 执行器接口

```typescript
interface TaskExecutor {
  name: string;
  execute(context: TaskContext): Promise<TaskResult>;
}
```

6 个执行器均实现此接口，内部调用 `aiService` 或 `vectorService` 完成具体工作。

### 2.6 IPC 通道

[smart-task.ipc.ts](file:///d:/Code/Github/Wrisp/src/main/ipcMain/smart-task.ipc.ts)：

| 通道 | 用途 |
|---|---|
| `smart-task:execute` | 触发智能任务执行 |
| `smart-task:getStatus` | 获取调度器状态 |
| `smart-task:cancel` | 取消当前执行 |
| `smart-task:pause` / `resume` | 暂停/恢复 |

---

## 3. Task Queue 子系统（持久化任务队列）

> 目录：`src/main/core/task-queue/`

### 3.1 职责

Task Queue 是通用的持久化后台任务队列，独立于 Smart Tasks。支持多 worker 并发、任务优先级、失败重试、应用重启后恢复（resume-on-start）。当前注册的 handler 为 `model:download-file`（本地模型文件下载）。

### 3.2 核心文件

| 文件 | 职责 |
|---|---|
| [task-queue.ts](file:///d:/Code/Github/Wrisp/src/main/core/task-queue/task-queue.ts) | 队列入队/出队，基于 TaskDao 持久化 |
| [task-executor.ts](file:///d:/Code/Github/Wrisp/src/main/core/task-queue/task-executor.ts) | Worker 循环，handler 分发，重试逻辑 |
| [types.ts](file:///d:/Code/Github/Wrisp/src/main/core/task-queue/types.ts) | `TaskHandler`、`ITaskQueue`、`ITaskExecutor` 接口 |

### 3.3 数据结构

```typescript
type TaskHandler = (task: Task) => Promise<unknown>;

interface ITaskQueue {
  enqueue(input: EnqueueTaskInput): Promise<string>;
  dequeue(): Promise<Task | null>;
  updateStatus(id, status, result?, error?): Promise<void>;
  cancel(id: string): Promise<void>;
  getTasksByGroup(groupId: string): Promise<Task[]>;
  resetRunningTasks(): Promise<void>;  // 重启时恢复
}
```

### 3.4 Worker 模型

- `startWorkers(concurrency = 3)`：启动 3 个并发 worker。
- 每个 worker 循环 `dequeue()` → 按 `type` 找 handler → 执行 → 更新状态。
- `IDLE_TIMEOUT_MS = 5000`：无任务时休眠 5 秒再轮询。
- **resume-on-start**：应用启动时 `resetRunningTasks()` 将上次中断的 running 状态重置为 pending，重新入队。

### 3.5 Handler 注册

[main/index.ts](file:///d:/Code/Github/Wrisp/src/main/index.ts) 启动时注册：

```
taskExecutor.registerHandler("model:download-file", modelDownloadHandler);
taskExecutor.startWorkers(3);
```

---

## 4. Model Gateway 子系统（模型网关）

> 目录：`src/main/core/model-gateway/`

### 4.1 职责

Model Gateway 是所有 AI 调用的统一网关，负责：
- 厂商适配器管理（openai/claude/deepseek/qwen/volcengine/local）
- 模型路由（本地 vs 云端）
- 故障转移与熔断
- Token 用量计账

### 4.2 两层路由

**第 1 层：本地/云端路由** — [router.ts](file:///d:/Code/Github/Wrisp/src/main/core/model-gateway/router.ts)

```
modelRouter.route(taskType)
  ├─ taskRules[taskType].primary (cloud)
  ├─ isCloudAvailable() → 是则走云端
  └─ fallback (local) → isLocalAvailable() → 走本地
```

9 种 TaskType 均配置为 `primary: cloud, fallback: local`。

**第 2 层：模型选择** — [model-selector.ts](file:///d:/Code/Github/Wrisp/src/main/core/model-gateway/llm-gateway/router/model-selector.ts)

```
ModelSelector.select(request)
  ├─ request.model 显式指定 → 按 model 找 adapter
  ├─ request.taskType → defaultModels 中 taskType 专属配置
  ├─ request.outputType → defaultModels 中通用 outputType 配置
  ├─ providerPriority 轮询
  └─ 默认 adapter
```

### 4.3 故障转移

[failover-handler.ts](file:///d:/Code/Github/Wrisp/src/main/core/model-gateway/llm-gateway/router/failover-handler.ts)：

- 指数退避重试（`maxRetries` 次）。
- 熔断器：`failureCount >= threshold` 触发熔断，`cooldownMs` 后自动恢复。
- 熔断后切换到 `providerPriority` 下一个可用 Provider。

### 4.4 适配器层

| Adapter | 继承 | 默认 baseUrl |
|---|---|---|
| OpenAIAdapter | BaseAdapter | `https://api.openai.com/v1` |
| DeepSeekAdapter | OpenAIAdapter | `https://api.deepseek.com` |
| QwenAdapter | OpenAIAdapter | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| VolcengineAdapter | OpenAIAdapter | `https://ark.cn-beijing.volces.com/api/v3` |
| ClaudeAdapter | BaseAdapter | `https://api.anthropic.com/v1` |
| LocalAdapter | OpenAIAdapter | —（Ollama） |

`BaseAdapter` 声明 `listModels(): Promise<Model[]>`，各适配器调用厂商 `/models` 接口。元信息由 `model-meta.service.ts` 从远程 `provider-models.json` 补充。

---

## 5. Scheduler 子系统（定时调度）

> 目录：`src/main/core/scheduler/`

### 5.1 职责

后台定时任务调度器，管理 backup、cleanup、log cleanup、resource sync 四类周期任务。

### 5.2 定时任务

| 任务 | 间隔 | 说明 |
|---|---|---|
| Backup | 配置驱动 | 数据库自动备份 |
| Cleanup | 配置驱动 | 过期数据清理 |
| Log Cleanup | 配置驱动 | 日志文件清理 |
| Resource Sync | 24 小时 | 模板 + 模型元信息远程同步 |

### 5.3 启动

[main/index.ts](file:///d:/Code/Github/Wrisp/src/main/index.ts)：

```
scheduler.startAll()
  ├─ startBackupSchedule()
  ├─ startCleanupSchedule()
  ├─ startLogCleanupSchedule()
  └─ startResourceSyncSchedule()  // 每 24h 调用 resourceSyncService.checkAndSync()
```

资源同步有 24 小时冷却守卫：距上次成功同步不足 24 小时则跳过启动同步，由定时任务兜底。

---

## 6. 三者关系与区别

| 维度 | Skills | Smart Tasks | Task Queue |
|---|---|---|---|
| 触发方式 | 用户主动（slash command / 设置页） | 用户主动（文档智能分析） | 系统自动 + 用户主动 |
| 执行模型 | L1 单轮 / L2 ReAct 多轮 | DAG 拓扑顺序 | 多 worker 并发 |
| LLM 调用 | aiService.chatCompletion | 各 executor 内部调用 | 通常不直接调用 LLM |
| 持久化 | 执行记录（可选） | TaskExecution 记录 | Task 表（必选，支持 resume） |
| 并发控制 | L2 信号量=1 | 串行（DAG 依赖） | 3 workers |
| 典型场景 | 翻译/润色/改写/扩写 | 文档摘要/概念/主题 | 模型文件下载 |

### 协作关系

1. **Skills → Model Gateway**：`SkillExecutor` 构造 `LLMRequest`（含 `taskType`），通过 `aiService.chatCompletion` → `modelRouter.route` → `LLMGateway` → `FailoverHandler` → `ModelSelector.select` → Adapter。
2. **Smart Tasks → Model Gateway**：各 executor（如 `ChunkSummaryExecutor`）内部调用 `aiService` 完成摘要/提取，调用 `vectorService` 完成向量化。
3. **Task Queue**：独立运行，当前仅用于模型文件下载，不直接依赖 Model Gateway。
4. **Scheduler → Resource Sync**：每日同步远程 skill/template/model-meta 资源到本地，更新后 Skills 系统和 Model Gateway 自动加载新资源。

---

## 7. 数据流：技能执行全链路

```
用户在编辑器输入 slash command 选择 skill
  │
  ▼
Renderer: window.electronAPI.skill.execute(skillId, inputs)
  │
  ▼
Preload: ipcRenderer.invoke("skill:execute", skillId, inputs)
  │
  ▼
ipcMain: skill.ipc.ts → skill.api.ts → SkillExecutor.execute()
  │
  ├─ skillManager.getSkillDefinition(skillId)
  ├─ validateInputs (JSON Schema)
  ├─ renderPrompt ({{变量}} 插值)
  ├─ applyPreProcess
  │
  ├─ [L1] aiService.chatCompletion(request)
  │     │
  │     ▼
  │   AIService.chatCompletion()
  │     ├─ modelRouter.route(request.taskType) → "cloud"
  │     ├─ LLMGateway.chatCompletion(request)
  │     │   └─ FailoverHandler.execute()
  │     │       ├─ ModelSelector.select(request)
  │     │       ├─ adapter.chatCompletion(request)
  │     │       └─ 失败 → 重试/熔断/切换 Provider
  │     └─ 返回 LLMResponse
  │
  ├─ [L2] ReAct 循环
  │     ├─ aiService.chatCompletion(request + tools)
  │     ├─ 有 toolCalls → toolRegistry.execute() → 结果加入 messages
  │     └─ 无 toolCalls → 结束
  │
  └─ applyPostProcess → 返回 SkillExecuteResult
```

---

## 8. 资源同步机制

[resource-sync.service.ts](file:///d:/Code/Github/Wrisp/src/main/core/services/resource-sync.service.ts)：

- **远程仓库**：`github.com/liqms/wrisp`，`main` 分支 `resources/` 目录。
- **manifest.json**：记录所有资源文件的 `type/path/version/sha256`。
- **同步策略**：
  - `SLASH`/`PAGE`/`SKILL`：仅同步已安装条目（依赖 `installed.json`）。
  - `MODEL_META`：始终同步（全局文件，非用户安装项）。
- **触发时机**：
  - 应用启动时（24h 冷却守卫）。
  - Scheduler 每日定时任务。
  - 用户手动触发（`resource:syncNow` IPC）。
- **更新后**：广播 `resource:updated` 事件，renderer 按变更类型刷新缓存；model-meta 变更时清 `ModelMetaService` 缓存。
