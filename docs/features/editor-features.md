# 编辑器功能文档

> Wrisp 编辑器基于 Tiptap v3 深度定制，是用户所有内容输入与创作的核心载体。
> 本文档覆盖编辑器架构、11 个功能扩展、交互菜单、Slash 命令系统及自定义数据块体系。

---

## 一、架构总览

### 1.1 核心入口

[TiptapEditor.vue](../../src/renderer/components/editor/TiptapEditor.vue) 是编辑器入口组件，接收 Markdown 作为 `modelValue`，通过 `marked` 异步转 HTML 后载入 ProseMirror 文档。集成 BubbleMenu、ImageBubbleMenu、SlashMenu、ContextMenu、TableEdgeControls 等子组件，通过 props 控制各功能开关（`slashCommand`、`enableBubbleMenu` 默认开启）。

### 1.2 扩展注册

[extensions.ts](../../src/renderer/components/editor/extensions.ts) 中 `getExtensions()` 统一组装全部扩展：

- **StarterKit**（关闭内置 link/underline/codeBlock/dropcursor）+ 20+ 自定义扩展
- 三个 marked 桥接在模块加载时幂等注册：`registerWrispBlockBridge`（自定义块）、`registerAdmonitionBridge`（提示块）、`registerTaskItemBridge`（任务项）
- `dedupeExtensions()` 按扩展 name 去重，避免重复注册同名扩展
- `createEditorExtensions()` 工厂函数支持追加自定义扩展并去重

### 1.3 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    TiptapEditor.vue                         │
│              (Markdown ↔ HTML ↔ PM Document)                │
├─────────────────────────────────────────────────────────────┤
│  extensions.ts — getExtensions() 统一注册 20+ 扩展           │
├──────────┬──────────┬──────────┬──────────┬────────────────┤
│ features │  menus   │  slash   │  blocks  │  containers    │
│ (11 个)  │ (2 个)   │ (命令)   │ (自定义) │ (Journal/Page) │
└──────────┴──────────┴──────────┴──────────┴────────────────┘
```

### 1.4 marked 桥接双链路模式

自定义块、提示块、任务项均采用统一的双链路架构：

```
读取：md 文件 ──marked.parse──▶ 桥接 HTML ──setContent──▶ PM 文档(自定义节点)
保存：PM 文档 ──renderMarkdown──▶ 原始 md 语法 ──写盘──▶ md 文件
```

桥接 HTML 只存在于内存解析管线，**不落盘**。

---

## 二、容器组件

### 2.1 JournalBlock（日志容器）

[JournalBlock.vue](../../src/renderer/components/editor/containers/JournalBlock.vue)

日志编辑容器，显示日期标题行 + 内嵌 TiptapEditor。支持"今天"高亮（`is-today` class），今天最小高度 300px、其他 200px，最大高度 10000px。内容变更时通过 `useJournal` composable 保存，Enter 键触发保存。日期显示按 `journalDateFormat` 配置格式化，拆分 YYYY-MM-DD 为本地时间构造 Date 避免时区偏移。

### 2.2 PageBlock（页面容器）

[PageBlock.vue](../../src/renderer/components/editor/containers/PageBlock.vue)

页面编辑容器，包含可编辑标题输入框 + TiptapEditor 正文。防抖自动保存，Enter 键在标题框中跳转正文焦点。向上 emit `catalog`（1-3 级标题目录）和 `catalog-active`（当前定位章节索引）。`scroll.capture` 捕获编辑器内部滚动不冒泡，驱动目录高亮；通过 `usePage` composable 读写页面数据。

---

## 三、编辑器扩展（Features）

编辑器在 `features/` 目录下组织 11 个功能扩展，每个扩展自包含扩展定义和 Vue NodeView 组件。

### 3.1 提示块（Admonition）

| 项目 | 说明 |
|------|------|
| 文件 | [admonition-extension.ts](../../src/renderer/components/editor/features/admonition/admonition-extension.ts)、[AdmonitionView.vue](../../src/renderer/components/editor/features/admonition/AdmonitionView.vue) |
| 语法 | `:::type ... :::` 围栏，支持 note/tip/info/warning/danger 五种类型 |
| 实现 | 自定义 `Node` + `VueNodeViewRenderer`；marked 桥接 tokenizer 解析围栏 → 桥接 HTML → parseHTML 还原节点；保存时 renderMarkdown 输出 `:::type` 围栏 |
| 细节 | 嵌套围栏计数正确处理闭合归属；非法类型回退 `note` |

### 3.2 代码块（CodeBlock）

| 项目 | 说明 |
|------|------|
| 文件 | [code-block-extension.ts](../../src/renderer/components/editor/features/code-block/code-block-extension.ts)、[CodeBlockView.vue](../../src/renderer/components/editor/features/code-block/CodeBlockView.vue) |
| 能力 | 基于 `CodeBlockLowlight`，37 种语言语法高亮（lowlight common 语言集） |
| UI | 自定义 Vue NodeView 提供右上角悬浮工具栏（语言选择 + 复制） |
| 细节 | `stopEvent`/`ignoreMutation` 隔离工具栏交互；默认语言 javascript；parseHTML 同时查找 `pre` 和 `code` 子元素的 `language-*` class |

### 3.3 拖拽排序（Drag Reorder）

| 项目 | 说明 |
|------|------|
| 文件 | [drag-reorder.ts](../../src/renderer/components/editor/features/drag-reorder/drag-reorder.ts) |
| 能力 | 块级拖拽排序，含拖拽手柄（"＋ 添加块"按钮 + ⠿ 六点图标）、DropLine 插入线插件（蓝色落点指示 + 边缘自动滚动） |
| 细节 | 落点算法使用 ProseMirror 原生 `dropPoint()`，插入线位置恒等于实际插入位置；手柄定位从 absolute 改为 fixed 视口定位以适配 Naive UI 滚动布局 |

### 3.4 图片（Image）

| 项目 | 说明 |
|------|------|
| 文件 | [image-extension.ts](../../src/renderer/components/editor/features/image/image-extension.ts)、[ImageView.vue](../../src/renderer/components/editor/features/image/ImageView.vue)、[ImageBubbleMenu.vue](../../src/renderer/components/editor/features/image/ImageBubbleMenu.vue) |
| 能力 | 基于官方 Image 扩展，新增 `width`（40-1600px）和 `align`（left/center/right）属性 |
| UI | 选中时右下角缩放手柄，拖拽按比例调整宽度并持久化 |
| 细节 | `stopEvent`/`ignoreMutation` 隔离手柄交互；对齐通过容器 `text-align` 实现；parseHTML 兼容 `width` 属性和 `style` 中的 `width:Npx` |

### 3.5 内联语义（Inline Semantic）

分为装饰与建议两个子模块：

**装饰** — [inline-semantic-decoration.ts](../../src/renderer/components/editor/features/inline-semantic/inline-semantic-decoration.ts)

ProseMirror Decoration 插件，为文档中的 `[[双链]]`、`#标签`、`@人物` 添加 Logseq 风格药丸渲染（纯视觉，不改文档结构）。按分段构造 decoration 拼出完整药丸（首段左圆角、尾段右圆角、符号段弱化样式）。悬浮 token 时全部段追加 `is-token-hover` 实现联动高亮；跳过代码块内 token。

**建议** — [inline-semantic-suggest.ts](../../src/renderer/components/editor/features/inline-semantic/inline-semantic-suggest.ts)

`@` 触发人物搜索、`#` 触发标签搜索的 Suggestion 下拉插件。通过 Electron API 查询人物表和标签表，选中后插入纯文本（非节点）。空 query 时不搜索不显示下拉。基于 `@tiptap/suggestion`，下拉渲染为纯 DOM（非 Vue 组件）。

### 3.6 数学公式（Mathematics）

| 项目 | 说明 |
|------|------|
| 文件 | [mathematics-extension.ts](../../src/renderer/components/editor/features/math/mathematics-extension.ts) |
| 能力 | 基于官方 `Mathematics` 扩展，支持行内 `$...$` 和块级 `$$...$$` 公式，KaTeX 渲染 |
| 编辑 | 点击公式节点派发 `wrisp-math-edit` 事件，弹出纯 DOM LaTeX 输入浮层 |
| 细节 | 浮层 fixed 定位 z-index 10000，Enter/✓ 确认、Esc/✕/外部点击取消；同一时间只保留一个浮层 |

### 3.7 @提及（Mention，旧版兼容）

| 项目 | 说明 |
|------|------|
| 文件 | [mention-extension.ts](../../src/renderer/components/editor/features/mention/mention-extension.ts) |
| 说明 | 旧版 `@tiptap/extension-mention` 的兼容扩展，仅保留历史文档的解析与渲染能力，不再触发 suggestion |
| 细节 | `addProseMirrorPlugins()` 返回空数组，移除内置 suggestion 插件避免与新扩展的 `@` 触发冲突。新输入走 `inline-semantic-suggest` 插入纯文本 |

### 3.8 注音（Ruby）

| 项目 | 说明 |
|------|------|
| 文件 | [ruby-extension.ts](../../src/renderer/components/editor/features/ruby/ruby-extension.ts) |
| 能力 | 自定义 `Node` 实现 `<ruby>正文<rt>注音</rt></ruby>` 注音标注，用于汉字拼音、日文假名等 |
| 命令 | `setRuby(annotation)` 和 `unsetRuby()` |
| 细节 | `inline: true, group: "inline", content: "text*"`；Markdown 序列化以内联 HTML 保存，读取经 marked html token 解析链路还原 |

### 3.9 表格（Table）

| 项目 | 说明 |
|------|------|
| 文件 | [table-extension.ts](../../src/renderer/components/editor/features/table/table-extension.ts)、[TableEdgeControls.vue](../../src/renderer/components/editor/features/table/TableEdgeControls.vue) |
| 能力 | 基于官方 `@tiptap/extension-table` 封装，支持 GFM 管道表格 |
| 修复 | 重写 `renderMarkdown`，保存前将单元格内 `|` 替换为哨兵字符 `\uE000`，渲染后统一替换为 `\\|`，修复官方不转义 `|` 的缺陷 |
| 细节 | `protectCellPipes` 递归保护表格 JSON 中文本节点；使用 `TableMap`、`CellSelection` 等 ProseMirror tables 工具 |

### 3.10 任务项（Task Item）

| 项目 | 说明 |
|------|------|
| 文件 | [task-item-extension.ts](../../src/renderer/components/editor/features/task-item/task-item-extension.ts)、[TaskItemView.vue](../../src/renderer/components/editor/features/task-item/TaskItemView.vue) |
| 语法 | `- [ ]`/`- [x]` 任务行（含缩进嵌套） |
| 实现 | 自定义 `WrispTaskItem` + marked 桥接，双链路同 admonition 模式 |
| 细节 | 日期通过 `[[YYYY-MM-DD]]` 行内文本表达，由 inline-sem Decoration 渲染药丸；marked 桥接 `start()` 提前断段避免命中代码块；嵌套内容用 `parseIndentedBlocks` 递归解析 |

---

## 四、交互菜单

### 4.1 气泡菜单（BubbleMenu）

[BubbleMenu.vue](../../src/renderer/components/editor/menus/BubbleMenu.vue)

选中文本时显示的浮动工具栏（placement: top, offset: 8），提供：

- 块类型切换（下拉）
- 提示块类型切换（仅 `editor.isActive('admonition')` 时显示）
- 对齐方式
- 粗体/删除线/斜体/下划线等行内格式按钮

每个按钮显示快捷键提示和激活状态。

### 4.2 右键菜单（ContextMenu）

[ContextMenu.vue](../../src/renderer/components/editor/menus/ContextMenu.vue)

基于 Naive UI `NDropdown` 的右键上下文菜单：

- 未选中文本：粘贴、全选
- 选中文本：剪切、复制、粘贴、全选
- 快捷键提示按平台区分（macOS ⌘ / 其他 Ctrl+）

---

## 五、Slash 命令系统

### 5.1 斜杠菜单 UI

[SlashMenu.vue](../../src/renderer/components/editor/slash/SlashMenu.vue)

输入 `/` 触发的命令选择面板，Teleport 到 body。包含搜索输入框 + 分组命令列表，支持键盘导航（上下选择、回车执行）和鼠标点击。按搜索文本过滤命令组，无匹配时显示空状态。图标支持 Vue 组件和 HTML 字符串（经 `sanitizeHtml` 清洗）。

### 5.2 命令注册

[registry.ts](../../src/renderer/components/editor/slash/commands/registry.ts)

`getCommandGroups(t, templateItems)` 聚合四类命令：

| 命令组 | 来源 | 内容 |
|--------|------|------|
| 基础块 | [basic-blocks.commands.ts](../../src/renderer/components/editor/slash/commands/basic-blocks.commands.ts) | 正文/标题/列表/代码块/引用/分割线/图片/公式/提示块/表格 |
| 日期时间 | [dateTime.commands.ts](../../src/renderer/components/editor/slash/commands/dateTime.commands.ts) | 今天、日期选择器、当前时间（插入 `[[YYYY-MM-DD]]` 格式） |
| 自定义块 | [blocks.commands.ts](../../src/renderer/components/editor/slash/commands/blocks.commands.ts) | 指标卡片等（由块注册表自动生成） |
| 职业模板 | [templates.ts](../../src/renderer/components/editor/slash/commands/templates.ts) | 按当前职业 + enabled 过滤动态追加 |

基础块命令中 `notInTableCell` 守卫阻止在表格单元格内插入多行/围栏块；图片命令调用 `electronAPI.attachment.importImage()` 选择本地图片并插入 `app://` 节点；公式命令调用 `showInlineMathInput` 弹出输入浮层。

---

## 六、自定义数据块（Custom Blocks）

自定义数据块体系允许在 Markdown 中嵌入结构化数据组件。以指标卡片（metric）为例说明如何声明、解析、渲染、编辑、序列化一个结构化数据块，以及如何新增自己的数据块类型。

### 6.1 背景与目标

普通 Markdown 只有纯文本语义，无法承载结构化数据（指标卡、联系人卡等）。目标：

- **落盘纯文本**：md 文件只存 `:::metric` 围栏 + `key: value` 字段行，外部编辑器打开不乱码，diff 友好
- **渲染靠前端**：卡片视觉由 Vue 组件渲染，数据与样式彻底分离
- **字段全受控**：非法枚举、超长、格式错误一律回退默认值，杜绝脏数据写入 md
- **声明式扩展**：新增一种数据块只需追加一个「块定义」，解析/节点/弹窗/slash 命令全部自动生成

### 6.2 架构

```
┌────────────────────────── 声明层 ──────────────────────────┐
│ registry.ts            WrispBlockDefinition / Field schema │
│ definitions/metric.ts  指标卡块定义（字段 + 组件引用）        │
└────────────────────────────────────────────────────────────┘
          │ getBlocks()
          ├─────────────────────────┬────────────────────────┐
          ▼                         ▼                        ▼
┌──── 解析桥接层 ────┐   ┌──── 节点工厂层 ─────┐   ┌─ Slash 命令层 ──┐
│ engine/            │   │ engine/             │   │ slash/commands/ │
│  marked-bridge.ts  │   │  node-factory.ts    │   │  blocks.        │
│  md-codec.ts       │   │  atom 节点 + 分组    │   │  commands.ts    │
│  ::: → 桥接 HTML   │   │  容器节点            │   │  插入 + 并组     │
└────────────────────┘   └─────────────────────┘   └─────────────────┘
          │                         │                        │
          ▼                         ▼                        ▼
┌──── 展示/编辑层 ────────────────────────────────────────────┐
│ components/ MetricCardView / MetricGroupView（NodeView）      │
│ components/ BlockEditModal / BlockEditHost / bus.ts（弹窗总线）│
└─────────────────────────────────────────────────────────────┘
```

### 6.3 md 约定语法

```md
:::metric
label: 日活跃用户
value: 1.2万
unit: 万
trend: +8%
trendDir: up
:::
```

- 围栏：`:::metric` 开启，`:::` 闭合；未闭合降级为普通段落文本（不丢内容）
- 字段行：`key: value`，key 限字母开头、字母数字下划线连字符
- **归组规则**：同类围栏（无论中间有无空行）始终归入同一 `metricGroup` flex 容器，每行最多 3 张卡，行内换行由布局自动完成。卡片与普通段落之间的空行正常分隔
- 序列化规则：空值与等于默认值的字段**省略**，保证 round-trip 幂等且 md 干净

### 6.4 声明层

**registry.ts** — [registry.ts](../../src/renderer/components/editor/blocks/registry.ts) 定义两个核心类型：

- `WrispBlockField`：字段 schema——`key`（md 字段名 = 节点 attr 名）、`type`（text/number/enum/boolean）、`labelKey`（i18n）、`default`、`required`、`maxLength`、`pattern`、`enumValues`
- `WrispBlockDefinition`：块定义——`type`（节点名）、`mdName`（围栏名）、`fields`（顺序即序列化顺序）、`cardView`（卡片 NodeView 组件）、`groupView`（可选分组容器组件，声明后自动生成 `${type}Group` 节点）、`titleKey`/`descKey`/`slashIcon`（slash 菜单元数据）

注册表本体只有一个数组，**新增块在此追加一行即可**：

```ts
const blocks: WrispBlockDefinition[] = [metricCardBlock];
```

**definitions/metric.ts** — [metric.ts](../../src/renderer/components/editor/blocks/definitions/metric.ts) 声明 5 个字段：`label`（必填，≤20）、`value`（必填，≤20）、`unit`（≤10）、`trend`（正则 `/^[+-]?\d+(\.\d+)?%?$/` 校验，如 `+12.5`/`-3`/`8%`）、`trendDir`（枚举 up/down/flat）。

### 6.5 引擎层

**md-codec.ts** — [md-codec.ts](../../src/renderer/components/editor/blocks/engine/md-codec.ts) 是字段读写的唯一权威，tokenizer 与 parseHTML 共用同一套校验：

- `sanitizeFieldValue`：非字符串→默认值；超长截断；空串时 enum 回退默认值、text 保留空；enum 词表外回退默认值；pattern 不通过回退默认值
- `sanitizeAttrs`：全字段校验，返回与 schema 对齐的干净 attrs（未知字段自动丢弃）
- `serializeFields`：按 schema 顺序输出，空值/默认值省略（确定性序列化）
- `parseFence(lines, openLine)`：从开启行下一行读字段直到闭合行，未闭合返回 null（交回 marked 降级）
- `serializeFence`：attrs → `:::name\nkey: value\n:::` 文本

**marked-bridge.ts** — [marked-bridge.ts](../../src/renderer/components/editor/blocks/engine/marked-bridge.ts) 在全局 `marked` 单例上注册块级扩展：

- `start` 回调：段落内部遇到 `:::name` 时提前断段（不吞内容）
- `tokenizer`：消费一段连续围栏为一个组 token——解析每张卡的 `parseFence`，跳过空行继续归组（空行不作为组边界；遇到非同类围栏停止）
- `renderer`：输出桥接 HTML——卡片 `<div data-wrisp-block="metric" data-f-label="..." data-f-trend-dir="..."></div>`，声明 groupView 时外层包 `<div data-wrisp-block-group="metric">`
- `registerWrispBlockBridge(getBlocks())` 在 extensions.ts 模块加载时幂等注册

**node-factory.ts** — [node-factory.ts](../../src/renderer/components/editor/blocks/engine/node-factory.ts) 由块定义生成 Tiptap 节点扩展：

- **卡片节点**（`name = def.type`）：`group: "block"`、`atom: true`、`selectable: true`；`addAttributes` 按 fields 生成（`parseHTML` 从 `data-f-<kebab>` 读并 sanitize）；`parseHTML` 匹配 `div[data-wrisp-block="<type>"]`；`renderHTML` 输出桥接 HTML；`renderMarkdown` 走 `serializeFence`
- **分组容器节点**（声明 groupView 时）：`name = <type>Group`、`content: "<type>*"`、`defining: true`；`renderMarkdown` 用 `helpers.renderChildren` 序列化子卡片

### 6.6 展示与编辑层

**NodeView 组件**

- [MetricCardView.vue](../../src/renderer/components/editor/blocks/components/MetricCardView.vue)：单卡渲染（label/value/unit/trend + 趋势图标与配色），双击或 hover 编辑按钮发起编辑，hover 删除按钮 `deleteNode()`
- [MetricGroupView.vue](../../src/renderer/components/editor/blocks/components/MetricGroupView.vue)：`NodeViewContent` 作为 flex 容器；hover 时行末"+"按钮 `addCard()`——按钮跟随最后一张卡片定位（ResizeObserver + node watch 重算），无卡片或所在行已满时隐藏；在组内内容末尾（close 标记之前）`tr.insert` 追加默认卡并打开弹窗

卡片排版样式（每组最多 3 列、行距大于列距）：

```scss
.metric-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  row-gap: 16px;

  :deep(.metric-card-wrap) {
    flex: 1 1 calc((100% - 2 * 12px) / 3);
    max-width: calc((100% - 2 * 12px) / 3);
    min-width: 0;
    margin: 0;
  }
}
```

**编辑弹窗总线**

[bus.ts](../../src/renderer/components/editor/blocks/components/bus.ts) 是全进程单例 `shallowRef`：NodeView 调 `openBlockEditor({ editor, pos, nodeType, attrs })`，全局唯一 [BlockEditHost.vue](../../src/renderer/components/editor/blocks/components/BlockEditHost.vue)（挂在 [App.vue](../../src/renderer/App.vue)）响应，避免每个 NodeView 挂一份 modal。

- [BlockEditModal.vue](../../src/renderer/components/editor/blocks/components/BlockEditModal.vue)：字段 schema 驱动的受控表单——enum 渲染 `n-select`，text 渲染 `n-input`（maxlength 受限）；required/pattern 生成校验规则；保存前统一 `sanitizeAttrs` 兜底
- 宿主保存：`setNodeMarkup(pos, undefined, newAttrs)` 写回节点；**保存前校验 `nodeAt(pos).type.name === nodeType`**（弹窗打开期间 undo/redo 可能使 pos 失效）

**slash 插入与并组**

[blocks.commands.ts](../../src/renderer/components/editor/slash/commands/blocks.commands.ts) 的 `insertBlock(editor, pos, def)`：

1. `deleteSlashText` 删除 `/查询词`
2. **并组探测**：当前文本块已空且前一个同级块是同类分组时，插入点 = `$from.before(depth) - 1`（前邻分组 close 标记之前 = 组内内容末尾），直接把卡追加进组
3. 否则 `replaceSelectionWith` 创建新分组（与重载后文档结构一致，保证 round-trip 稳定）
4. 新节点位置通过**节点对象同一性**在事务后的文档中 `descendants` 定位（不依赖插入后光标落点），随后 `openBlockEditor` 自动打开弹窗

### 6.7 i18n

块定义只声明 key，文案集中在 [zhCN.ts](../../src/shared/i18n/locales/zhCN.ts) / [enUS.ts](../../src/shared/i18n/locales/enUS.ts) 的 `EDITOR.BLOCKS` 下：

```ts
BLOCKS: {
  GROUP_LABEL: "数据块",
  COMMON: { INPUT_PLACEHOLDER / REQUIRED / FORMAT_INVALID },
  METRIC: {
    TITLE / DESC / EDIT_HINT / EMPTY_HINT / ADD_CARD,
    FIELDS: { LABEL / VALUE / UNIT / TREND / TREND_DIR },
    TREND_DIR: { UP / DOWN / FLAT },
  },
}
```

### 6.8 新增一个自定义数据块的步骤

以新增 `:::quote` 引用卡为例：

1. **定义块**：新建 `src/renderer/components/editor/blocks/definitions/quote.ts`，导出 `WrispBlockDefinition`（type/mdName/fields/组件/i18n key）
2. **视图组件**：在 `components/` 新建 `QuoteCardView.vue`（必选）与 `QuoteGroupView.vue`（需要归组布局时），模板用 `NodeViewWrapper`，编辑入口调 `openBlockEditor`
3. **注册**：在 `registry.ts` 的 `blocks` 数组追加一行——marked 桥接、Tiptap 节点、弹窗表单、slash 命令全部自动生效
4. **i18n**：两个 locale 文件补 `EDITOR.BLOCKS.QUOTE.*` 文案
5. **测试**：在 `tests/unit/renderer/blocks/round-trip.test.ts` 补该块的 round-trip / 清洗 / 归组用例

无需改动 extensions.ts、registry.ts（slash）、App.vue、TiptapEditor.vue——声明式注册表已驱动全部接线。

### 6.9 测试

[round-trip.test.ts](../../tests/unit/renderer/blocks/round-trip.test.ts)（35 个用例）覆盖：

- **解析**：围栏 → 桥接 HTML 断言 → 节点结构与 attrs
- **清洗**：非法枚举回退默认值、未知字段丢弃
- **序列化**：默认值字段省略、round-trip 幂等
- **归组**：连续围栏归单组、空行分隔的同类围栏仍归一组、卡片与段落间空行正常分隔
- **降级**：未闭合围栏回退普通文本、段落内围栏提前断段不吞内容
- **插入**：slash 插入定位/自动开弹窗、连续插入并入前邻分组、段落含其他文本时独立成组
- **追加**：分组末尾 addCard 默认 attrs 来自 schema、结构保持

运行：`pnpm vitest run tests/unit/renderer/blocks/`

### 6.10 关键经验（踩坑记录）

1. **归组语义选型**：曾把"空行 = 组边界"作为归组规则，结果用户保存的 md 里卡片间有空行，4 张卡解析成 4 个独立分组竖排。**布局型块的归组不应依赖空行**——同类围栏总是归为一组，分行交给 flex 布局
2. **ProseMirror 分组插入位置**：向分组追加卡片的插入点必须是**组内内容末尾（close 标记之前）**。`prevStart + 1 + prev.content.size` 是父容器层级，卡片会插到组外成为裸节点
3. **兄弟索引的深度**：`$from.index(depth)` 是块内子节点索引，`$from.index(depth - 1)` 才是当前块在父容器中的兄弟索引
4. **文本块边界扫描**：`doc.textBetween` 在节点边界返回空串 `""`（不是 `\n`），扫描循环必须以 `""` 为终止条件
5. **弹窗期间文档可能变动**：编辑弹窗打开期间用户可 undo/redo，保存前必须校验 `nodeAt(pos)` 仍是目标类型再 `setNodeMarkup`
6. **新节点定位用对象同一性**：插入后光标落点在空段落/段落中部等上下文下并不确定，用「节点对象引用相等」在事务后文档中 `descendants` 定位才可靠
7. **NodeView 的 scoped 样式**：@tiptap/vue-3 的 VueNodeView 通过 `__scopeId` 显式支持 scoped styles，跨 `render()` 裸挂载也正常继承 scopeId
8. **卡片的跨组件布局归父容器管**：卡片组件自身只做 `display: inline-flex`，flex 拉伸/约束统一由分组容器的 `:deep(.metric-card-wrap)` 控制

---

## 七、文件清单

```
src/renderer/components/editor/
├── TiptapEditor.vue              # 编辑器入口组件
├── extensions.ts                 # 扩展统一注册（getExtensions）
│
├── containers/
│   ├── JournalBlock.vue          # 日志编辑容器（日期标题 + 编辑器）
│   └── PageBlock.vue             # 页面编辑容器（标题 + 正文 + 目录）
│
├── features/                     # 编辑器功能扩展
│   ├── admonition/               # 提示块（:::type 围栏）
│   │   ├── admonition-extension.ts
│   │   └── AdmonitionView.vue
│   ├── code-block/               # 代码块（37 语言高亮 + 工具栏）
│   │   ├── code-block-extension.ts
│   │   └── CodeBlockView.vue
│   ├── drag-reorder/             # 拖拽排序（手柄 + DropLine）
│   │   └── drag-reorder.ts
│   ├── image/                    # 图片（缩放 + 对齐 + 气泡菜单）
│   │   ├── image-extension.ts
│   │   ├── ImageView.vue
│   │   └── ImageBubbleMenu.vue
│   ├── inline-semantic/          # 内联语义（药丸装饰 + @/# 建议）
│   │   ├── inline-semantic-decoration.ts
│   │   └── inline-semantic-suggest.ts
│   ├── math/                     # 数学公式（KaTeX + LaTeX 编辑浮层）
│   │   └── mathematics-extension.ts
│   ├── mention/                  # @提及（旧版兼容，不触发 suggestion）
│   │   └── mention-extension.ts
│   ├── ruby/                     # 注音（<ruby> 拼音/假名）
│   │   └── ruby-extension.ts
│   ├── table/                    # 表格（GFM + | 转义修复）
│   │   ├── table-extension.ts
│   │   └── TableEdgeControls.vue
│   └── task-item/                # 任务项（- [ ]/- [x] + 日期 chip）
│       ├── task-item-extension.ts
│       └── TaskItemView.vue
│
├── menus/
│   ├── BubbleMenu.vue            # 气泡菜单（行内格式 + 块类型切换）
│   └── ContextMenu.vue           # 右键菜单（剪切/复制/粘贴/全选）
│
├── slash/                        # Slash 命令系统
│   ├── SlashMenu.vue             # / 触发的命令选择面板
│   └── commands/
│       ├── registry.ts           # 命令组注册中心
│       ├── basic-blocks.commands.ts  # 基础块命令（标题/列表/代码块等）
│       ├── blocks.commands.ts    # 自定义块命令（指标卡片等）
│       ├── dateTime.commands.ts  # 日期时间命令
│       ├── templates.ts          # 职业模板命令
│       ├── datePicker.ts         # 日期选择器
│       ├── template-icons.ts     # 模板图标解析
│       ├── template-merge.ts     # 模板合并
│       ├── helpers.ts            # 命令工具函数
│       └── types.ts              # 命令类型定义
│
└── blocks/                       # 自定义数据块体系
    ├── registry.ts               # 块定义类型 + 注册表
    ├── definitions/
    │   └── metric.ts             # 指标卡块定义
    ├── engine/
    │   ├── md-codec.ts           # 字段编解码 + 校验回退
    │   ├── marked-bridge.ts      # :::name → 桥接 HTML
    │   └── node-factory.ts       # Tiptap 节点扩展工厂
    └── components/
        ├── MetricCardView.vue    # 卡片 NodeView
        ├── MetricGroupView.vue   # 分组容器 NodeView
        ├── BlockEditModal.vue    # schema 驱动编辑弹窗
        ├── BlockEditHost.vue     # 全局弹窗宿主
        └── bus.ts                # 弹窗编辑请求总线

src/shared/i18n/locales/
├── zhCN.ts / enUS.ts             # EDITOR.BLOCKS.* 文案

tests/unit/renderer/blocks/
└── round-trip.test.ts            # 35 用例：解析/清洗/序列化/归组/插入/追加
```
