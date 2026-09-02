# Agent: main-process-agent

> Tier 1 · 层级 Agent · 按需加载
> 负责主进程(src/main/**)修改的总体协调与跨子系统联动。

---

## 元信息

| 字段 | 值 |
|---|---|
| 名称 | `main-process-agent` |
| 层级 | Tier 1 |
| 触源 | `src/main/**` 任意修改 |
| 子域派发 | dao / ipc-channel / migration / model-gateway / smart-tasks / task-queue / vector / skills / scheduler |
| 参考文档 | [AGENTS.md](../../../AGENTS.md) |

---

## 加载时机

任务触及 `src/main/**` 任一子目录:

`constants/` `core/apis/` `core/db/` `core/migration/` `core/model-gateway/` `core/scheduler/` `core/services/` `core/skills/` `core/smart-tasks/` `core/task-queue/` `core/vector/` `ipcMain/` `preload/` `schemas/` `types/` `utils/` `index.ts` `menu.ts` `protocol.ts` `preload.ts`

---

## 知识域

### 入口与启动顺序

[src/main/index.ts](../../../src/main/index.ts):

1. env 加载(`dotenv`)
2. DB init / migration
3. 协议注册([protocol.ts](../../../src/main/protocol.ts))
4. skill manager + vector service 初始化
5. 持久任务队列恢复(用户确认 resume 流程)
6. 3 task workers 启动
7. window / menu / tray 创建
8. 17+1 IPC handler 组注册
9. `scheduler.startAll()`

> ⚠️ 改 `main/index.ts` 时勿破坏此顺序,尤其 DB→协议→skill/vector→queue→workers→window→IPC→scheduler。

### 子系统 → Tier 2 派发表

| 子系统 | 路径 | Tier 2 Agent |
|---|---|---|
| IPC handlers | `ipcMain/` | ipc-channel-agent |
| 数据访问 | `core/db/` + `schemas/` | dao-agent |
| 迁移 | `core/migration/` | migration-agent |
| 模型网关 | `core/model-gateway/` | model-gateway-agent |
| 智能任务 | `core/smart-tasks/` | smart-tasks-agent |
| 任务队列 | `core/task-queue/` | task-queue-agent |
| 向量服务 | `core/vector/` + `core/services/vector.service.ts` | vector-agent |
| 技能 | `core/skills/` | skills-agent |
| 调度器 | `core/scheduler/` | scheduler-agent |
| 业务服务 | `core/services/` + `core/apis/` | 本 Agent 直接处理(必要时委派) |

### IPC 注册现状(截至当前)

`main/index.ts` 实际调用:`window` `system` `logger` `config` `webview` `journal` `project` `ai` `skill` `model` `tag` `page` `concept` `topic` `reflection` `smart-task` `task` `update` `template`

⚠️ `search` 已在 [ipcMain/index.ts](../../../src/main/ipcMain/index.ts) 导出但 **未在 main/index.ts 调用**(端到端不可用,新增 search 通道需手动 wire)。

---

## 职责

1. 识别主进程侧触及的子系统,派发对应 Tier 2
2. 处理 `core/services/` 与 `core/apis/` 通用业务逻辑改造(无对应 Tier 2 时)
3. 协调跨子系统改动(如新 IPC 触库 → 联动 dao + ipc-channel)
4. 处理 `main/index.ts` 启动顺序变更(谨慎)
5. `menu.ts` / `protocol.ts` / `tray.service.ts` 等顶层文件改造

---

## 关键约束与陷阱

1. **Scheduler 已启用**:`scheduler.startAll()` 在 `main/index.ts` 运行——**勿当禁用处理**;backup/cleanup 在 `core/scheduler/`
2. **Preload 入口二次跳转**:[src/main/preload.ts](../../../src/main/preload.ts) 是薄包装,真实逻辑在 `preload/index.ts`;新模块加在 `preload/modules/` + 注册 `preload/modules/index.ts` + 类型 `preload/types/`
3. **`window` 破例**:无 `core/apis/window.api.ts`(4 层模式唯一破例)
4. **`error.ts` 已删**:错误响应走 [utils/response.ts](../../../src/main/utils/response.ts) 的 `ResponseWrapper` + API 层内联 try/catch
5. **DB 路径**:`<workspace>/sqlite/main.db`,workspace 自 config 或 `globalThis.__WRISP_WORKSPACE_PATH__`
6. **schemas 复制**:`init.sql` 由 `vite.config.ts:copySchemas` 拷到 `dist-electron/schemas`;DB schema 路径用 `__dirname` 解析(勿用 `import.meta.url`,CJS 下编译为 `undefined`)
7. **Worker 打包**:worker 文件单独 CJS 打包,经 `__dirname` 解析引用;`parentPort.on/postMessage`(非 `self.onmessage`)
8. **`pnpm rebuild`**:Node 版本升级后必跑(better-sqlite3 ABI)
9. **`pnpm clean` 仅 Windows**:`rd /Q /S`,Unix 用 `rm -rf dist-renderer dist-electron release`

---

## 必传上下文模板

```yaml
task: "<原始请求>"
touched_subsystems: [ipc | db | migration | model-gateway | smart-tasks | task-queue | vector | skills | scheduler | services | apis | main-entry | menu | protocol]
delegated_to:
  - <Tier 2 agent>: <子任务>
retains:
  - <本 Agent 直接处理的文件>
```

---

## 退出标准

- [ ] 触及的子系统已派发对应 Tier 2(或本 Agent 直接处理)
- [ ] `main/index.ts` 改动(若有)未破坏启动顺序
- [ ] 新 IPC handler 已在 main/index.ts 注册(除 search 域已知未 wire,需向用户提示)
- [ ] 无未使用导入/参数(strict tsconfig)
- [ ] (可选)`pnpm typecheck` 通过
