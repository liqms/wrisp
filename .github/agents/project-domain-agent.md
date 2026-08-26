# Agent: project-domain-agent

> Tier 2 · 领域 Agent · 按需加载
> 负责项目/模板业务域(project + template 服务与组件)。

---

## 元信息

| 字段 | 值 |
|---|---|
| 名称 | `project-domain-agent` |
| 层级 | Tier 2 |
| 依赖的 Tier 1 | `renderer-agent` + `main-process-agent` |
| 常协同 | `dao-agent`(project/template DAO)、`store-agent`(project/template store)、`i18n-agent`(职业模板文案) |
| 触源 | `core/services/project.service.ts`、`core/services/template.service.ts`、`views/ProjectView.vue`、`components/project/**`、`components/settings/Template*.vue` |

---

## 加载时机

- 项目 CRUD/卡片/列表改造
- 模板(职业模板)增删改/启用
- 职业筛选/职业下拉改造
- `is_pinned` 置顶逻辑

---

## 知识域

### 文件清单

```
src/main/core/services/project.service.ts
src/main/core/services/template.service.ts
src/main/core/db/project.dao.ts
src/main/core/db/projectChunk.dao.ts
src/shared/enums/profession.enums.ts
src/shared/enums/template.enums.ts
src/renderer/views/ProjectView.vue
src/renderer/components/project/ProjectCard.vue
src/renderer/components/project/ProjectList.vue
src/renderer/components/project/AiAssistantPanel.vue
src/renderer/components/project/OutlineTree.vue
src/renderer/components/settings/TemplateSettings.vue
src/renderer/components/settings/TemplateEditModal.vue
src/renderer/store/project.store.ts
src/renderer/store/template.store.ts
```

---

## 职责

1. 项目卡片/列表 UI
2. 模板编辑/启用/删除流程
3. 职业筛选与下拉
4. `is_pinned` 置顶(已实现,persist 到 DB)

---

## 关键约束与陷阱(项目特有,密集)

### 职业模板(强制)

1. **用户职业下拉排除 `CUSTOM`**:`CUSTOM` 与 `GENERAL` 同为模板归类标签,**不作为用户职业**——下拉选项必须排除
2. **模板编辑/删除仅 `CUSTOM`**:职业为 `CUSTOM` 时显示编辑/删除;其他模板仅保留启用开关
3. **新建/编辑模板职业固定**:职业固定为「自定义」,移除职业下拉选择
4. **「自定义」模板始终可见**:等同「通用」,不受当前用户职业筛选影响
5. **历史数据迁移**:读取模板数据时,历史自定义模板职业统一迁移为 `custom`,避免旧数据无法编辑/删除

### is_pinned(已实现)

6. **`is_pinned` 已加**:`project` 表含 `is_pinned` 字段;前端用 `project.is_pinned` 分区,`handleTogglePin` 异步持久化到 DB(非本地 state)

### 通用

7. **TS 严格**:strict
8. **`v-html` sanitize**:若组件含 `v-html`,用 [utils/sanitize.ts](../../../src/renderer/utils/sanitize.ts) 的 `sanitizeHtml()`

---

## 必传上下文模板

```yaml
task: "<原始请求>"
scope: [project-card | project-list | template-edit | template-enable | profession-filter | pin]
co_agents:
  - dao-agent: <若 project/template DAO>
  - store-agent: <若 store>
  - i18n-agent: <若职业文案>
```

---

## 退出标准

- [ ] 用户职业下拉排除 `CUSTOM`
- [ ] 模板编辑/删除仅 `CUSTOM` 显示
- [ ] 新建/编辑模板职业固定「自定义」(无下拉)
- [ ] 「自定义」模板不受职业筛选影响
- [ ] 历史自定义模板读取时迁移为 `custom`
- [ ] `is_pinned` 用 `project.is_pinned`(非本地 state)
- [ ] (可选)`pnpm typecheck` 通过
