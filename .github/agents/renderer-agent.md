# Agent: renderer-agent

> Tier 1 · 层级 Agent · 按需加载
> 负责渲染进程(src/renderer/**)修改的总体协调。

---

## 元信息

| 字段 | 值 |
|---|---|
| 名称 | `renderer-agent` |
| 层级 | Tier 1 |
| 触源 | `src/renderer/**` 任意修改 |
| 子域派发 | editor / store / ui-component / i18n / project-domain |
| 参考文档 | [AGENTS.md](../../../AGENTS.md) |

---

## 加载时机

任务触及 `src/renderer/**` 任一子目录:

`components/` `composables/` `layouts/` `plugins/` `router/` `store/` `styles/` `types/` `utils/` `views/` `App.vue` `main.ts`

---

## 知识域

### 入口与启动顺序

[src/renderer/main.ts](../../../src/renderer/main.ts):createApp → Router → Pinia → Naive UI → i18n → **await initI18n()** → app.mount()

⚠️ `initI18n()` 必须在 Pinia 创建后调用;`main.ts` await 后 mount,`App.vue` mounted 中再调一次。改 `main.ts`/`App.vue` 时勿破坏。

### 子系统 → Tier 2 派发表

| 子系统 | 路径 | Tier 2 Agent |
|---|---|---|
| 编辑器 | `components/editor/` | editor-agent |
| 状态管理 | `store/` + `composables/` | store-agent |
| UI 组件/样式 | `components/` + `styles/` | ui-component-agent |
| 国际化 | `plugins/i18n.ts`(+ shared) | i18n-agent |
| 项目/模板业务 | `views/ProjectView.vue` + `components/project/` + `components/settings/TemplateSettings.vue` | project-domain-agent |

### 路由

- Hash history:[router/index.ts](../../../src/renderer/router/index.ts)
- MenuLayout 下:Welcome / Journal / Wiki / Projects
- ⚠️ 无路由守卫;`SettingsView` 是 modal 组件(非路由视图)
- ⚠️ Capture/Think/Chat 路由已移除,`views/webview/` 已空——勿引用

### Store 现状(15 个 composition API store)

ai, config, download, journal, model, notification, page, project, shortcut, system, tag, template, webview, wiki

### Composable 现状(14 个)

useAIStream, useConfig, useJournal, useModel, useNotification, usePage, useProject, useSearch, useShortcut, useSystem, useTag, useTheme, useWebView, useWiki

---

## 职责

1. 识别渲染侧触及的子系统,派发对应 Tier 2
2. 处理通用组件/视图/router 改造(无对应 Tier 2 时)
3. 保证 i18n init 顺序不被破坏
4. 通过 `window.electronAPI.*` 调用主进程时,确认对应 IPC 已存在(否则联动 ipc-channel-agent)

---

## 关键约束与陷阱

1. **i18n init 顺序**:`initI18n()` 在 [plugins/i18n.ts](../../../src/renderer/plugins/i18n.ts);`main.ts` await 后 mount + `App.vue` mounted 再调一次
2. **Composition API 优先**:`<script setup>` + Composition API,除非项目明确要求 Options API
3. **`v-html` 必须 sanitize**:用 [src/renderer/utils/sanitize.ts](../../../src/renderer/utils/sanitize.ts) 的 `sanitizeHtml()`
4. **Naive UI teleport 陷阱**:n-dropdown / n-popover / setting 下拉 teleport 后 scoped 样式失效 → 用自定义 class(如 `context-menu`/`setting-select-menu`)+ 非 scoped 全局样式
5. **n-icon 颜色**:用原生 `color` prop,勿用 `:style`(内部 undefined 会覆盖)
6. **MenuLayout 硬编码**:[MenuLayout.vue](../../../src/renderer/layouts/MenuLayout.vue) "作品" 菜单标签硬编码中文(Journal 用 i18n)
7. **TS 严格**:`noUnusedLocals` + `noUnusedParameters` strict,未用导入/参数 build 失败
8. **样式**:Sass(sass-embedded)SCSS;`@/` 别名 → `./src/`
9. **错误处理**:调用 IPC 失败用 `handleApiError(result, true)`(来自 [utils/error.utils.ts](../../../src/renderer/utils/error.utils.ts))

---

## 必传上下文模板

```yaml
task: "<原始请求>"
touched_areas: [components | composables | layouts | plugins | router | store | styles | types | utils | views | main.ts | App.vue]
delegated_to:
  - <Tier 2 agent>: <子任务>
retains:
  - <本 Agent 直接处理的文件>
```

---

## 退出标准

- [ ] 触及子系统已派发对应 Tier 2(或本 Agent 直接处理)
- [ ] i18n init 顺序未被破坏
- [ ] 新增 `v-html` 已用 `sanitizeHtml()`
- [ ] Naive UI teleport 组件用非 scoped 全局样式
- [ ] 无未使用导入/参数
- [ ] (可选)`pnpm typecheck` 通过
