# Agent: shared-agent

> Tier 1 · 层级 Agent · 按需加载
> 负责主进程↔渲染进程共享代码(src/shared/**)的修改。

---

## 元信息

| 字段 | 值 |
|---|---|
| 名称 | `shared-agent` |
| 层级 | Tier 1 |
| 触源 | `src/shared/**` 任意修改,或需新增跨进程共享类型/枚举 |
| 常协同 | 几乎所有 Tier 2(IPC/DAO 都需 shared 类型) |
| 参考文档 | [AGENTS.md](../../../AGENTS.md) |

---

## 加载时机

- 任务触及 `src/shared/**` 任一子目录(`enums/` `i18n/` `types/` `utils/`)
- 用户新增 IPC/DAO 时,需先在 shared 加类型/枚举(由 wrisp-router 派发先行)
- 用户新增国际化文案(联动 i18n-agent)

---

## 知识域

### 目录结构

- `enums/`:ai, config, errorCode, journal, log, page, profession, project, provider, task, template, themeColor, user
- `types/`:api, base, chunk, config, journal, llm, menu, model, notification, page, skill, system, tag, task, template, webview
- `i18n/`:`types.ts` + `locales/enUS.ts` + `locales/zhCN.ts`
- `utils/`:id, object, pagination, time, validate

### 关键模式

**枚举模式**(强制):
```typescript
export const X = { ... } as const
type X = (typeof X)[keyof typeof X]
```

**ApiResponse 模式**(IPC/Service 共用):
- 来自 `@/shared/types`,`{ success: boolean, data?: T, error?: {...} }`

**别名**:`@/` → `./src/`

---

## 职责

1. 新增/修改实体类型(实体/创建 DTO/更新 DTO)
2. 新增/修改枚举(严格 `as const` 模式)
3. 新增错误码(`errorCode.enums.ts`,格式 `'ERROR.DOMAIN.ACTION_FAILED'`)
4. 新增国际化文案 key(联动 i18n-agent 补 enUS/zhCN)
5. 通用工具函数(`utils/`)——优先复用,勿重复造

---

## 关键约束与陷阱

1. **枚举模式强制**:`export const X = {...} as const` + `type X = (typeof X)[keyof typeof X]`——勿用传统 `enum`
2. **`@/` 别名**:`@/shared/...`,统一用别名
3. **TS 严格**:`noUnusedLocals` + `noUnusedParameters` strict
4. **i18n 文案双向**:`enUS.ts` 与 `zhCN.ts` 必须同步新增 key,否则类型检查可能漏过但运行时缺失
5. **utils 优先复用**:时间用 `utils/time.ts`,ID 用 `utils/id.ts`,分页用 `utils/pagination.ts`,对象操作用 `utils/object.ts`,校验用 `utils/validate.ts`——勿在 main/renderer 重复实现
6. **TimeUtil 占位符**:`utils/time.ts` 支持 `MMM`(月缩写)/`MMMM`(月全名)/`D`(日无前导零)等,替换顺序已调以避免子串冲突——扩展时勿破坏顺序

---

## 必传上下文模板

```yaml
task: "<原始请求>"
changes:
  - type: [entity-type | create-dto | update-dto | enum | error-code | i18n-key | util]
    name: "<标识>"
    domain: "<所属域>"
co_agents:
  - i18n-agent: <若 i18n-key>
  - ipc-channel-agent: <若 error-code 供 API 层>
  - dao-agent: <若 entity-type>
```

---

## 退出标准

- [ ] 新枚举符合 `as const` 模式
- [ ] 新错误码格式 `'ERROR.DOMAIN.ACTION_FAILED'`
- [ ] 新 i18n key 在 enUS + zhCN 双向同步
- [ ] 新类型在 `types/index.ts` 导出
- [ ] 新枚举在 `enums/index.ts` 导出
- [ ] 无未使用导入/参数
- [ ] (可选)`pnpm typecheck` 通过
