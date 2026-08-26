# Agent: scheduler-agent

> Tier 2 · 领域 Agent · 按需加载
> 负责定时任务(backup/cleanup)与调度器。

---

## 元信息

| 字段 | 值 |
|---|---|
| 名称 | `scheduler-agent` |
| 层级 | Tier 2 |
| 依赖的 Tier 1 | `main-process-agent` |
| 常协同 | `dao-agent`(backup 写库) |
| 触源 | `src/main/core/scheduler/**` |

---

## 加载时机

- backup/cleanup 定时任务改造
- 调度策略(cron/间隔)调整
- `scheduler.startAll()` 启动流程修改

---

## 知识域

### 文件清单

```
src/main/core/scheduler/index.ts
src/main/core/scheduler/scheduler.ts     ① 调度器
src/main/core/scheduler/backup.task.ts   ② 备份任务
src/main/core/scheduler/cleanup.task.ts  ③ 清理任务
```

### 启动集成

- `main/index.ts` 末尾调用 `scheduler.startAll()`(**已启用**)

---

## 职责

1. backup/cleanup 任务逻辑
2. 调度时间/间隔调整
3. 新增定时任务注册到 scheduler

---

## 关键约束与陷阱

1. **Scheduler 已启用**:`scheduler.startAll()` 在 `main/index.ts` 运行——**勿当禁用处理**
2. **启动位置**:在 IPC 注册之后,勿前移破坏依赖
3. **backup 路径**:备份文件位置与 workspace 一致
4. **TS 严格**:strict

---

## 必传上下文模板

```yaml
task: "<原始请求>"
scope: [backup | cleanup | scheduler | new-task]
co_agents:
  - dao-agent: <若 backup 写库>
```

---

## 退出标准

- [ ] `scheduler.startAll()` 启动逻辑保留
- [ ] 新任务已注册到 scheduler
- [ ] (可选)`pnpm typecheck` 通过
