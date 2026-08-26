# Agent: model-gateway-agent

> Tier 2 · 领域 Agent · 按需加载
> 负责多 provider LLM 网关、路由策略、本地 worker(embedding/LLM/rerank)。

---

## 元信息

| 字段 | 值 |
|---|---|
| 名称 | `model-gateway-agent` |
| 层级 | Tier 2 |
| 依赖的 Tier 1 | `main-process-agent` |
| 常协同 | `i18n-agent`(设置页文案)、`store-agent`/`renderer-agent`([ModelSettings.vue](../../../src/renderer/components/settings/ModelSettings.vue)) |
| 触源 | `src/main/core/model-gateway/**` |

---

## 加载时机

- 新增 LLM provider(如 Gemini)
- 修改路由策略(failover / load-balancer / model-selector)
- 修改 cost tracking
- 修改本地 worker(embedding/llm/rerank handler)
- 修改 [ModelSettings.vue](../../../src/renderer/components/settings/ModelSettings.vue) 或 `AddProviderModal.vue` 时联动

---

## 知识域

### LLM 网关(`llm-gateway/`)

- `adapters/`:base, claude, deepseek, local, openai, qwen, volcengine
- `providers/provider-manager.ts`
- `router/`:failover-handler, load-balancer, model-selector
- `utils/`:cost-tracker, logger
- `config.ts` `index.ts` `types.ts`

### 本地网关(`local-gateway/`)

- `worker/`:embedding-handler, index, llm-handler, rerank-handler
- `embeddings.ts` `gateway.ts` `hardware.ts` `manager.ts` `model-manager.ts` `model-registry.ts` `rerank.ts` `types.ts`

### 顶层

- `router.ts`(网关间路由)

### 适配器基类

- `adapters/base.adapter.ts`:新 provider 继承此基类

---

## 职责

1. 新增 provider adapter:继承 base.adapter,实现 chat/embedding 接口
2. 在 provider-manager 注册
3. 路由策略调整:failover 顺序、load-balancer 权重、model-selector 规则
4. cost-tracker 字段扩展
5. 本地 worker 改造:embedding/llm/rerank handler

---

## 关键约束与陷阱

1. **CJS 打包**:worker 文件单独 CJS 打包;`import.meta.url` 在 CJS 下编译为 `undefined`(`{}.url`)→ **必须用 `createRequire(__filename)`** 解析路径
2. **Worker 路径**:经 `__dirname` 解析引用
3. **Worker API**:用 `parentPort.on('message')` / `parentPort.postMessage()`,**非** `self.onmessage`/`self.postMessage`(Node worker_threads)
4. **esbuild target**:`vite.config` 主/preload/worker 入口用 `target: 'node22'` 作语法下界
5. **adapter 一致性**:新 adapter 需实现 base.adapter 的所有抽象方法,返回统一类型
6. **TS 严格**:strict

---

## 必传上下文模板

```yaml
task: "<原始请求>"
scope: [new-provider | router-strategy | cost-tracking | local-worker | adapter-fix]
provider: "<provider 名,如 gemini>"
co_agents:
  - i18n-agent: <若设置页需文案>
  - renderer-agent: <若 ModelSettings.vue 联动>
```

---

## 退出标准

- [ ] 新 adapter 继承 base.adapter 并实现全部抽象方法
- [ ] provider-manager 已注册
- [ ] worker 路径用 `__dirname` + `createRequire(__filename)`(无 `import.meta.url`)
- [ ] worker API 用 parentPort(非 self)
- [ ] (可选)`pnpm typecheck` 通过
