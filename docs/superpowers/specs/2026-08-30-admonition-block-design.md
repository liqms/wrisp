# Admonition Block 设计文档

日期：2026-08-30
状态：已确认（方案 A）

## 目标

编辑器新增 Admonition（提示块）：Obsidian 风格的 `:::type` 围栏容器，可包裹任意块级内容，通过斜杠命令插入、气泡菜单切换类型，明暗主题自适应。

## 需求确认

- 类型集：`note` / `tip` / `info` / `warning` / `danger`（5 种）
- 交互：斜杠菜单单命令插入默认 `note`；选中后经气泡菜单下拉切换类型
- 视觉：左边框卡片（类型色左边框 + 浅色背景 + 标题行）

## 语法

```markdown
:::warning
这里是警告内容，**支持行内格式**。
:::
```

嵌套：admonition 可嵌套 admonition 及其他块（列表、代码块、指标卡片等）。

## 架构（方案 A：项目现有桥接模式）

参照官方指南（tiptap.dev markdown admonition guide）四段式（Node → tokenizer → parser → renderer），落到本项目的双链路结构：

- **读取链路**（`TiptapEditor.mdToHtml`，全局 marked 单例）：
  marked 桥接扩展 tokenizer 消费 `:::type ... :::` → renderer 输出 `<div data-admonition data-type="...">嵌套 HTML</div>` → Tiptap `parseHTML` 规则 `div[data-admonition]` → PM 按编辑器 schema 解析内部块为 content。
- **序列化链路**（`editor.getMarkdown()`，`@tiptap/markdown` MarkdownManager）：
  节点声明 `renderMarkdown(node, helpers)`，子块用 `helpers.renderChildren(node.content, "\n\n")`（与官方 Document 节点一致），输出 `:::type\n\n{children}\n\n:::`。

**不采用**官方 `markdownTokenizer` 扩展字段的原因：读取链路不经 MarkdownManager 的 marked 实例，主链路不生效（marked-bridge 已有注释说明裸 tokenizer 的二次注册问题）。

### tokenizer 细节

- 开行 `^:::(note|tip|info|warning|danger)[ \t]*$`，闭行 `^:::[ \t]*$`
- 与 metric 卡片围栏（`:::metric` 等具名开行）零冲突
- **嵌套计数**：任何 `^:::\w+` 行 depth+1，裸 `^:::` 行 depth-1 —— 同时正确处理嵌套 admonition 与内部 metric 围栏
- 未闭合围栏：tokenizer 返回 undefined，交回 marked 按普通段落降级（与 metric 桥接一致）
- 内部内容经 `lexer.blockTokens(inner)` 递归解析（renderer 端 `this.parser.parse(tokens)`）
- 幂等注册到全局 marked 单例

### 节点 schema

- `group: 'block'`、`content: 'block+'`、`defining: true`
- 属性 `type`：默认 `note`，白名单校验（parseHTML 时非法值回退 `note`）
- 命令复用内置 `toggleWrap('admonition')` / `updateAttributes('admonition', { type })`，无自定义命令

## 组件与数据流

```
斜杠菜单（basic-blocks.commands.ts）
  └─ deleteSlashText → toggleWrap('admonition', { type: 'note' })
气泡菜单（BubbleMenu.vue）
  ├─ 块类型面板新增"提示块"项（toggleWrap / lift）
  └─ isActive('admonition') 时显示类型下拉（5 项，updateAttributes 切换）
读取：marked 桥接 → parseHTML
保存：renderMarkdown → ::: 围栏
```

## 样式（_markdown.scss）

左边框卡片，类型色映射 Naive UI 主题变量（明暗主题自动适配）：

| 类型 | 变量 | 标题（中文） |
|------|------|------|
| note | `--primary-color` | 笔记 |
| tip | `--success-color` | 提示 |
| info | `--info-color` | 信息 |
| warning | `--warning-color` | 警告 |
| danger | `--error-color` | 危险 |

- 左边框 3px 类型色；背景 `color-mix(in srgb, <类型色> 7%, transparent)`（明暗主题底色自然透出）
- 标题行：CSS `::before` 按类型显示中文标题（编辑态与阅读态共用，`_markdown.scss` 已是共享样式层）
- 编辑器内外共用同一套 `.markdown-body` 样式

## i18n

- 斜杠命令：`EDITOR.SLASH.BASIC_BLOCKS.ADMONITION_TITLE/DESC`（zhCN + enUS 同步，locale-keys 测试强制）
- BubbleMenu 标签与类型名：硬编码中文（该组件现状一致，见 AGENTS.md 坑点 #9）

## 测试（tests/unit/renderer/blocks/admonition.test.ts）

复用 round-trip.test.ts 模式（Editor + StarterKit + Markdown + 全局 marked）：

1. 围栏 → 桥接 HTML → admonition 节点（含 type 属性）
2. 嵌套 admonition 解析（depth 计数）
3. 内部 metric 围栏不干扰闭合
4. 未闭合降级为段落
5. 类型白名单回退 note
6. getMarkdown 往返幂等（加载 → 序列化 → 再加载一致）
7. toggleWrap 插入 + updateAttributes 切换后序列化正确

## 明确不做

- Admonition 内部缩进适配（blockquote 的 `>` 前缀式缩进）——围栏语法天然界定范围
- 行内 admonition、折叠/展开状态
- 跨编辑器拖拽之外的特别适配（DragHandle 对顶层块通用支持已覆盖）
