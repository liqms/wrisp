# Agent: task-queue-agent

> Tier 2 · 领域 Agent · 按需加载
> 负责持久任务队列、3 workers、resume-on-start 流程。

---

## 元信息

| 字段 | 值 |
|---|---|
| 名称 | `task-queue-agent` |
| 层级 | Tier 2 |
| 依赖的 Tier 1 | `main-process-agent` |
| 常协同 | `model-gateway-agent`(`model:download-file` handler) |
| 触源 | `src/main/core/task-queue/**` |

---

## 加载时机

- 任务队列改造
- worker 数量/行为调整
- resume-on-start 流程修改
- `model:download-file` handler 改造

---

## 知识域

### 文件清单

```
src/main/core/task-queue/index.ts
src/main/core/task-queue/task-queue.ts     ① 队列
src/main/core/task-queue/task-executor.ts  ② 执行器(3 workers)
src/main/core/task-queue/singleton.ts      ③ 单例
src/main/core/task-queue/types.ts
```

### 启动集成

- `main/index.ts` 启动时恢复持久任务队列(用户确认 resume 流程)
- 启动 3 个 task workers

### 已知 handler

- `model:download-file`(model 下载任务)

---

## 职责

1. 队列数据结构/优先级调整
2. worker 行为/数量修改
3. resume 流程:启动时恢复未完成任务,需用户确认
4. 新增任务类型 handler

---

## 关键约束与陷阱

1. **resume 需用户确认**:启动恢复流程需用户确认,勿静默自动执行
2. **3 workers**:默认 3 个 worker,调整时考虑并发与资源
3. **持久化**:队列状态持久化到 DB,勿丢任务
4. **`model:download-file` 已存在**:新增 model 下载任务类型时复用此 handler
5. **TS 严格**:strict

---

## 必传上下文模板

```yaml
task: "<原始请求>"
scope: [queue | worker | resume | handler]
co_agents:
  - model-gateway-agent: <若 model:download-file>
```

---

## 退出标准

- [ ] resume 流程保留用户确认
- [ ] 队列状态持久化
- [ ] (可选)`pnpm typecheck` 通过
