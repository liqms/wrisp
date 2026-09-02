# Agent: smart-tasks-agent

> Tier 2 · 领域 Agent · 按需加载
> 负责 DAG 任务调度与 6 个 executor。

---

## 元信息

| 字段 | 值 |
|---|---|
| 名称 | `smart-tasks-agent` |
| 层级 | Tier 2 |
| 依赖的 Tier 1 | `main-process-agent` |
| 常协同 | `dao-agent`(chunk/concept/topic DAO)、`vector-agent`(vectorize)、`model-gateway-agent`(LLM 调用) |
| 触源 | `src/main/core/smart-tasks/**` |

---

## 加载时机

- 新增/修改 executor
- DAG 依赖关系调整
- 进度管理(progress.manager)改造
- 任务调度策略(scheduler)调整

---

## 知识域

### 文件清单

```
src/main/core/smart-tasks/index.ts
src/main/core/smart-tasks/scheduler.ts        ① DAG 调度
src/main/core/smart-tasks/task-dag.ts          ② DAG 定义
src/main/core/smart-tasks/progress.manager.ts ③ 进度
src/main/core/smart-tasks/types.ts
src/main/core/smart-tasks/executors/
  ├ chunk-summary.executor.ts                 ④ 分块摘要
  ├ chunk-vectorize.executor.ts               ⑤ 分块向量化
  ├ concept-extract.executor.ts               ⑥ 概念抽取
  ├ semantic-link.executor.ts                 ⑦ 语义链接
  ├ topic-detection.executor.ts               ⑧ 话题检测
  └ topic-summary.executor.ts                 ⑨ 话题摘要
```

### DAG 节点(默认流)

`chunk-summary → chunk-vectorize → concept-extract → semantic-link → topic-detection → topic-summary`

---

## 职责

1. 新增 executor:实现统一接口,注册到 scheduler
2. DAG 依赖关系定义/调整
3. 进度上报(progress.manager)
4. 与 model-gateway(LLM)、vector(向量化)、dao(chunk/concept/topic)联动

---

## 关键约束与陷阱

1. **v2 表专用**:executor 写入 `semantic_chunks`/`concept_chunks`/`topic_chunks`/`concepts`/`topics`/`topic_concepts`,勿引用 v1 表(`blocks` 等)
2. **`semantic_chunks` 禁含字段**:`content_type`/`source`/`language`/`metadata`/`parent_chunk_id`/`split_index`/`is_memo`
3. **executor 接口一致**:实现统一接口,返回统一进度/结果类型
4. **DAG 顺序**:勿破坏 `chunk-summary` 先于 `chunk-vectorize` 等依赖
5. **TS 严格**:strict

---

## 必传上下文模板

```yaml
task: "<原始请求>"
scope: [new-executor | dag-adjust | progress | scheduler]
executor: "<executor 名>"
co_agents:
  - dao-agent: <若触库>
  - vector-agent: <若 vectorize>
  - model-gateway-agent: <若调 LLM>
```

---

## 退出标准

- [ ] 新 executor 实现统一接口
- [ ] scheduler 已注册
- [ ] DAG 依赖未被破坏
- [ ] 仅写 v2 表
- [ ] (可选)`pnpm typecheck` 通过
