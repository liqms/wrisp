# Agent: store-agent

> Tier 2 · 领域 Agent · 按需加载
> 负责 Pinia 状态管理(store + composable 包装)。

---

## 元信息

| 字段 | 值 |
|---|---|
| 名称 | `store-agent` |
| 层级 | Tier 2 |
| 依赖的 Tier 1 | `renderer-agent` |
| 常协同 | `ipc-channel-agent`(store 调 IPC)、`i18n-agent`(store 内文案) |
| 触源 | `src/renderer/store/**`、`src/renderer/composables/**` |

---

## 加载时机

- 新增/修改 Pinia store
- 新增/修改 composable 包装
- store ↔ IPC 联动

---

## 知识域

### Store 现状(15 个 composition API store)

ai, config, download, journal, model, notification, page, project, shortcut, system, tag, template, webview, wiki

### Composable 现状(14 个)

useAIStream, useConfig, useJournal, useModel, useNotification, usePage, useProject, useSearch, useShortcut, useSystem, useTag, useTheme, useWebView, useWiki

### 文件位置

```
src/renderer/store/<domain>.store.ts
src/renderer/composables/use<Domain>.ts
src/renderer/store/index.ts
src/renderer/composables/index.ts
```

---

## 职责

1. 新增 store(composition API)
2. 新增 composable 包装 store
3. store 调 IPC 时联动 ipc-channel-agent
4. 状态/响应式逻辑调整

---

## 关键约束与陷阱

1. **Composition API + `<script setup>`**:优先,除非项目明确要求 Options API
2. **i18n init 顺序**:`initI18n()` 在 Pinia 创建后调用——改 store 注册时机勿破坏
3. **错误处理**:调用 IPC 失败用 `handleApiError(result, true)`(来自 [utils/error.utils.ts](../../../src/renderer/utils/error.utils.ts))
4. **TS 严格**:strict
5. **composable 包装**:store 不直接在组件用,经 composable 包装(项目惯例)

---

## 必传上下文模板

```yaml
task: "<原始请求>"
scope: [new-store | modify-store | new-composable | ipc-link]
domain: "<域>"
co_agents:
  - ipc-channel-agent: <若新 IPC>
  - i18n-agent: <若文案>
```

---

## 退出标准

- [ ] store 用 composition API
- [ ] composable 包装已加
- [ ] `store/index.ts` + `composables/index.ts` 导出
- [ ] i18n init 顺序未破坏
- [ ] (可选)`pnpm typecheck` 通过
