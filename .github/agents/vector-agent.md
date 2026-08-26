# Agent: vector-agent

> Tier 2 · 领域 Agent · 按需加载
> 负责 LanceDB 向量存储、embedding/rerank 检索。

---

## 元信息

| 字段 | 值 |
|---|---|
| 名称 | `vector-agent` |
| 层级 | Tier 2 |
| 依赖的 Tier 1 | `main-process-agent` |
| 常协同 | `model-gateway-agent`(embedding/rerank worker)、`smart-tasks-agent`(chunk-vectorize)、`dao-agent`(vector.dao) |
| 触源 | `src/main/core/vector/**`、`src/main/core/services/vector.service.ts`、`src/main/core/db/vector.dao.ts` |

---

## 加载时机

- LanceDB schema/表结构改造
- embedding/rerank 检索逻辑
- 向量索引/查询方法
- 启动时 vector service 初始化改造

---

## 知识域

### 文件清单

```
src/main/core/vector/lancedb.ts                  ① LanceDB 封装
src/main/core/services/vector.service.ts        ② 业务服务
src/main/core/db/vector.dao.ts                   ③ 向量 DAO
```

### 启动集成

- `main/index.ts` 启动时初始化 vector service(在 IPC 注册前)

---

## 职责

1. LanceDB 表/schema 调整
2. embedding 写入/检索方法
3. rerank 调用
4. 与 model-gateway 本地 worker 联动

---

## 关键约束与陷阱

1. **LanceDB schema**:与 `semantic_chunks` 等 v2 表对齐
2. **`semantic_chunks` 禁含字段**:`content_type`/`source`/`language`/`metadata`/`parent_chunk_id`/`split_index`/`is_memo`(同 dao-agent 约束)
3. **初始化顺序**:vector service 在 IPC 注册前初始化,勿破坏
4. **TS 严格**:strict

---

## 必传上下文模板

```yaml
task: "<原始请求>"
scope: [schema | embedding | rerank | query | init]
co_agents:
  - model-gateway-agent: <若调本地 worker>
  - smart-tasks-agent: <若 vectorize 联动>
  - dao-agent: <若 vector.dao>
```

---

## 退出标准

- [ ] LanceDB schema 与 v2 表对齐
- [ ] 向量初始化顺序未破坏
- [ ] (可选)`pnpm typecheck` 通过
