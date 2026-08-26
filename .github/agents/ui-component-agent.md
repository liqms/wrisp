# Agent: ui-component-agent

> Tier 2 · 领域 Agent · 按需加载
> 负责 Naive UI 组件、样式、scoped 样式陷阱处理。

---

## 元信息

| 字段 | 值 |
|---|---|
| 名称 | `ui-component-agent` |
| 层级 | Tier 2 |
| 依赖的 Tier 1 | `renderer-agent` |
| 常协同 | `i18n-agent`(组件文案)、`store-agent`(组件状态) |
| 触源 | `src/renderer/components/**`、`src/renderer/styles/**` |

---

## 加载时机

- Naive UI 组件改造
- 样式/主题调整
- dropdown/popover/select teleport 样式问题
- n-icon 颜色问题

---

## 知识域

### 组件目录

- `components/base/`:ColorCard, DownloadButton, DownloadProgressPanel, FeatureCard, FunctionCard
- `components/project/`:AiAssistantPanel, OutlineTree, ProjectCard, ProjectList
- `components/settings/`:AddProviderModal, DataManagement, GeneralSettings, KeymapSettings, ModelDefault, ModelItem, ModelSettings, ProviderItem, TemplateEditModal, TemplateSettings
- `components/welcome/`:WelcomeApiConfigStep, WelcomeModelDownloadStep, WelcomeWorkspaceStep
- `components/wiki/`:ConceptGraph, TopicList
- 根:AppHeader, GlobalSearch, NotificationToast, SettingsView, UpdatePrompt, WebViewContainer

### 样式

- `styles/`:global.scss, themes.scss, _variables.scss, _fonts.scss, _markdown.scss
- Sass(sass-embedded)SCSS

---

## 职责

1. Naive UI 组件选用/配置
2. 样式/主题/变量调整
3. teleport 组件样式穿透处理
4. n-icon 颜色处理

---

## 关键约束与陷阱(项目特有,密集)

1. **n-dropdown teleport 失效**:scoped 样式(`data-v` 属性)**不影响** Naive UI n-dropdown 菜单(teleport 到组件 DOM 树外);`:deep()` 也失效(h() 生成元素无 scoped 属性)→ **用自定义 class(如 `context-menu`)+ 非 scoped 全局样式**,类名前缀穿透
2. **n-icon 颜色**:用原生 `color` prop,**勿用 `:style`**(内部 undefined 会覆盖)
3. **setting 下拉自适应**:`setting-select-menu` 非 scoped 全局类,让弹出菜单宽度自适应最长选项
4. **样式语言**:Sass SCSS,`@/` 别名
5. **TS 严格**:strict
6. **`v-html` sanitize**:若组件含 `v-html`,用 [utils/sanitize.ts](../../../src/renderer/utils/sanitize.ts) 的 `sanitizeHtml()`

---

## 必传上下文模板

```yaml
task: "<原始请求>"
scope: [component | style | theme | dropdown | icon]
component: "<组件名>"
co_agents:
  - i18n-agent: <若文案>
  - store-agent: <若状态>
```

---

## 退出标准

- [ ] teleport 组件用非 scoped 全局样式 + 自定义 class
- [ ] n-icon 用 `color` prop(非 `:style`)
- [ ] setting 下拉用 `setting-select-menu` 类
- [ ] (可选)`pnpm typecheck` 通过
