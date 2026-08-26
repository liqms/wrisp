# Agent: i18n-agent

> Tier 2 · 领域 Agent · 按需加载
> 负责国际化文案(enUS/zhCN)与 initI18n 初始化。

---

## 元信息

| 字段 | 值 |
|---|---|
| 名称 | `i18n-agent` |
| 层级 | Tier 2 |
| 依赖的 Tier 1 | `renderer-agent` + `shared-agent` |
| 常协同 | 几乎所有 Tier 2(组件/错误码文案) |
| 触源 | `src/shared/i18n/**`、`src/renderer/plugins/i18n.ts` |

---

## 加载时机

- 新增/修改文案 key
- enUS/zhCN 同步
- initI18n 初始化改造
- 错误码需配套文案

---

## 知识域

### 文件清单

```
src/shared/i18n/types.ts
src/shared/i18n/locales/enUS.ts
src/shared/i18n/locales/zhCN.ts
src/renderer/plugins/i18n.ts        ① initI18n()
src/renderer/main.ts                 ② await initI18n() 后 mount
src/renderer/App.vue                 ③ mounted 中再调 initI18n()
```

### init 顺序

1. `main.ts`:createApp → Router → Pinia → Naive UI → i18n → **await initI18n()** → app.mount()
2. `App.vue` mounted:再调一次 `initI18n()`

⚠️ `initI18n()` 必须在 Pinia 创建后调用(Pinia store 提供语言配置)

---

## 职责

1. 新增文案 key(同步 enUS + zhCN)
2. 调整文案结构/命名空间
3. initI18n 初始化逻辑
4. 错误码配套文案(联动 shared-agent 的 `errorCode.enums.ts`)

---

## 关键约束与陷阱

1. **enUS + zhCN 双向同步**:新增 key 必须两语言都加,否则类型检查可能漏过但运行时缺失
2. **initI18n 顺序**:在 Pinia 创建后;`main.ts` await 后 mount,`App.vue` mounted 再调一次——改 `main.ts`/`App.vue` 勿破坏
3. **key 命名**:遵循现有命名空间(如 `APP.XXX`、`ERROR.XXX`)
4. **TS 严格**:strict

---

## 必传上下文模板

```yaml
task: "<原始请求>"
scope: [new-key | restructure | init]
keys:
  - key: "<i18n key>"
    en: "<英文>"
    zh: "<中文>"
namespace: "<命名空间>"
co_agents:
  - shared-agent: <若 errorCode 文案>
```

---

## 退出标准

- [ ] 新 key 在 enUS + zhCN 双向同步
- [ ] initI18n 顺序未破坏
- [ ] key 遵循现有命名空间
- [ ] (可选)`pnpm typecheck` 通过
