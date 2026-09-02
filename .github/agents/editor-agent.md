# Agent: editor-agent

> Tier 2 · 领域 Agent · 按需加载
> 负责 Tiptap 编辑器、ProseMirror 扩展、SlashMenu、BubbleMenu、ContextMenu。

---

## 元信息

| 字段 | 值 |
|---|---|
| 名称 | `editor-agent` |
| 层级 | Tier 2 |
| 依赖的 Tier 1 | `renderer-agent` |
| 常协同 | `i18n-agent`(slash 命令文案)、`store-agent`(journal store) |
| 触源 | `src/renderer/components/editor/**` |

---

## 加载时机

- Tiptap/ProseMirror 扩展改造
- SlashMenu 命令新增/修改
- BubbleMenu/ContextMenu 行为调整
- BlockEditor/JournalBlock/TiptapEditor 改造

---

## 知识域

### 文件清单

```
src/renderer/components/editor/BlockEditor.vue
src/renderer/components/editor/BubbleMenu.vue
src/renderer/components/editor/ContextMenu.vue
src/renderer/components/editor/EditorQuickActions.vue
src/renderer/components/editor/JournalBlock.vue
src/renderer/components/editor/TiptapEditor.vue
src/renderer/components/editor/extensions.ts
src/renderer/components/editor/slash/SlashMenu.vue
src/renderer/components/editor/slash/commands/
  ├ datePicker.ts
  ├ dateTime.commands.ts
  ├ helpers.ts
  ├ registry.ts
  ├ template-icons.ts
  ├ template-merge.ts
  ├ templates.ts
  └ types.ts
```

---

## 职责

1. ProseMirror 扩展新增/调整
2. SlashMenu 命令注册(registry)
3. BubbleMenu/ContextMenu 交互
4. 模板(template-merge)合并逻辑

---

## 关键约束与陷阱(项目特有,密集)

1. **`doc.resolve(pos).end()`**:获取当前文本块结束位置——用此,勿用固定窗口
2. **`textBetween` 跨块陷阱**:`doc.textBetween` 在节点边界返回 **空串 `""`**,而非 `\n`——扫描循环须检查 `""` 作为终止条件
3. **`textBetween` 拼接陷阱**:`textBetween` 跨块拼接时省略节点边界位置,`lastIndexOf()` 的字符串索引会错位映射到错误的绝对位置——**反向搜索必须绑定到当前块**
4. **反向 slash 搜索下界**:用 `doc.resolve(pos).start()`,**严禁** `Math.max(0, pos - N)`(固定窗口会跨入上一块)
5. **slash 查询词扫描**:限于当前文本块,在节点边界停止
6. **`v-html` 必须 sanitize**:用 [src/renderer/utils/sanitize.ts](../../../src/renderer/utils/sanitize.ts) 的 `sanitizeHtml()`
7. **TS 严格**:strict

---

## 必传上下文模板

```yaml
task: "<原始请求>"
scope: [extension | slash-command | bubble-menu | context-menu | template | block-editor]
command: "<命令名>"
co_agents:
  - i18n-agent: <若 slash 命令文案>
  - store-agent: <若 journal store 联动>
```

---

## 退出标准

- [ ] 反向搜索下界用 `doc.resolve(pos).start()`(非固定窗口)
- [ ] 扫描循环检查 `""` 终止
- [ ] slash 查询词扫描限于当前块
- [ ] 新增 `v-html` 已用 `sanitizeHtml()`
- [ ] (可选)`pnpm typecheck` 通过
