# 自定义数据块（Custom Blocks）开发指南

本文档梳理「自定义数据组件」体系的设计与完整实现过程，以指标卡片（metric）为例说明如何声明、解析、渲染、编辑、序列化一个结构化数据块，以及如何新增自己的数据块类型。

## 1. 背景与目标

普通 Markdown 只有纯文本语义，无法承载结构化数据（指标卡、联系人卡等）。目标：

- **落盘纯文本**：md 文件只存 `:::metric` 围栏 + `key: value` 字段行，外部编辑器打开不乱码，diff 友好
- **渲染靠前端**：卡片视觉由 Vue 组件渲染，数据与样式彻底分离
- **字段全受控**：非法枚举、超长、格式错误一律回退默认值，杜绝脏数据写入 md
- **声明式扩展**：新增一种数据块只需追加一个「块定义」，解析/节点/弹窗/slash 命令全部自动生成

## 2. 架构总览

```
┌────────────────────────── 声明层 ──────────────────────────┐
│ registry.ts            WrispBlockDefinition / Field schema │
│ definitions/metric.ts  指标卡块定义（字段 + 组件引用）        │
└────────────────────────────────────────────────────────────┘
          │ getBlocks()
          ├─────────────────────────┬────────────────────────┐
          ▼                         ▼                        ▼
┌──── 解析桥接层 ────┐   ┌──── 节点工厂层 ─────┐   ┌─ Slash 命令层 ─┐
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

单条数据流：

```
md 文件 ──marked.parse──▶ 桥接 HTML ──setContent──▶ PM 文档(metricGroup/metric 节点)
       ◀──renderMarkdown── PM 文档 ◀──(弹窗 setNodeMarkup)── 用户编辑
```

## 3. md 约定语法

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

## 4. 声明层

### 4.1 registry.ts（注册表与类型）

[registry.ts](../src/renderer/components/editor/blocks/registry.ts) 定义两个核心类型：

- `WrispBlockField`：字段 schema——`key`（md 字段名 = 节点 attr 名）、`type`（text/number/enum/boolean）、`labelKey`（i18n）、`default`、`required`、`maxLength`、`pattern`、`enumValues`
- `WrispBlockDefinition`：块定义——`type`（节点名）、`mdName`（围栏名）、`fields`（顺序即序列化顺序）、`cardView`（卡片 NodeView 组件）、`groupView`（可选分组容器组件，声明后自动生成 `${type}Group` 节点）、`titleKey`/`descKey`/`slashIcon`（slash 菜单元数据）

注册表本体只有一个数组，**新增块在此追加一行即可**：

```ts
const blocks: WrispBlockDefinition[] = [metricCardBlock];
```

### 4.2 definitions/metric.ts（指标卡定义）

[metric.ts](../src/renderer/components/editor/blocks/definitions/metric.ts) 声明 5 个字段：`label`（必填，≤20）、`value`（必填，≤20）、`unit`（≤10）、`trend`（正则 `/^[+-]?\d+(\.\d+)?%?$/` 校验，如 `+12.5`/`-3`/`8%`）、`trendDir`（枚举 up/down/flat）。

## 5. 引擎层

### 5.1 md-codec.ts（字段编解码）

[md-codec.ts](../src/renderer/components/editor/blocks/engine/md-codec.ts) 是字段读写的唯一权威，**tokenizer 与 parseHTML 共用同一套校验**，保证两条链路行为一致：

- `sanitizeFieldValue`：非字符串→默认值；超长截断；空串时 enum 回退默认值、text 保留空；enum 词表外回退默认值；pattern 不通过回退默认值
- `sanitizeAttrs`：全字段校验，返回与 schema 对齐的干净 attrs（未知字段自动丢弃）
- `serializeFields`：按 schema 顺序输出，空值/默认值省略（确定性序列化）
- `parseFence(lines, openLine)`：从开启行下一行读字段直到闭合行，未闭合返回 null（交回 marked 降级）
- `serializeFence`：attrs → `:::name\nkey: value\n:::` 文本
- `escapeHtmlAttr` / `kebabCase`：桥接 HTML 属性工具（`trendDir` → `data-f-trend-dir`）

### 5.2 marked-bridge.ts（md → 桥接 HTML）

[marked-bridge.ts](../src/renderer/components/editor/blocks/engine/marked-bridge.ts) 在全局 `marked` 单例上注册块级扩展。**桥接 HTML 只存在于内存解析管线，不落盘**：

- `start` 回调：段落内部遇到 `:::name` 时提前断段（不吞内容）
- `tokenizer`：消费一段连续围栏为一个组 token——解析每张卡的 `parseFence`，**跳过空行继续归组**（空行不作为组边界；遇到非同类围栏停止）
- `renderer`：输出桥接 HTML——卡片 `<div data-wrisp-block="metric" data-f-label="..." data-f-trend-dir="..."></div>`，声明 groupView 时外层包 `<div data-wrisp-block-group="metric">`
- `registerWrispBlockBridge(getBlocks())` 在 [extensions.ts](../src/renderer/components/editor/extensions.ts) 模块加载时幂等注册，读取链路（mdToHtml）与插入链路（insertMarkdownTemplate）均经该单例，**无需改动任何调用方**

### 5.3 node-factory.ts（Tiptap 节点生成）

[node-factory.ts](../src/renderer/components/editor/blocks/engine/node-factory.ts) 由块定义生成 Tiptap 节点扩展：

- **卡片节点**（`name = def.type`）：`group: "block"`、`atom: true`（无内联内容，字段全在 attrs）、`selectable: true`；`addAttributes` 按 fields 生成（`parseHTML` 从 `data-f-<kebab>` 读并 sanitize）；`parseHTML` 匹配 `div[data-wrisp-block="<type>"]`；`renderHTML` 输出桥接 HTML（往返一致）；`renderMarkdown` 走 `serializeFence`；`addNodeView` 挂 Vue 组件
- **分组容器节点**（声明 groupView 时）：`name = <type>Group`、`group: "block"`、`content: "<type>*"`、`defining: true`；`renderMarkdown` 用 `helpers.renderChildren` 序列化子卡片

## 6. 展示与编辑层

### 6.1 NodeView 组件

- [MetricCardView.vue](../src/renderer/components/editor/blocks/components/MetricCardView.vue)：单卡渲染（label/value/unit/trend + 趋势图标与配色），双击或 hover 编辑按钮发起编辑，hover 删除按钮 `deleteNode()`
- [MetricGroupView.vue](../src/renderer/components/editor/blocks/components/MetricGroupView.vue)：`NodeViewContent` 作为 flex 容器；hover 时行末"+"按钮 `addCard()`——按钮**跟随最后一张卡片定位**（ResizeObserver + node watch 重算），无卡片或所在行已满（需换行）时隐藏；按分组内容规则推导卡片类型（`groupNode.type.contentMatch.defaultType`），在**组内内容末尾**（`pos + 1 + groupNode.content.size`，close 标记之前）`tr.insert` 追加默认卡并打开弹窗

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

### 6.2 编辑弹窗总线

[bus.ts](../src/renderer/components/editor/blocks/components/bus.ts) 是全进程单例 `shallowRef`：NodeView 调 `openBlockEditor({ editor, pos, nodeType, attrs })`，全局唯一 [BlockEditHost.vue](../src/renderer/components/editor/blocks/components/BlockEditHost.vue)（挂在 [App.vue](../src/renderer/App.vue)）响应，避免每个 NodeView 挂一份 modal。

- [BlockEditModal.vue](../src/renderer/components/editor/blocks/components/BlockEditModal.vue)：字段 schema 驱动的受控表单——enum 渲染 `n-select`，text 渲染 `n-input`（maxlength 受限）；required/pattern 生成校验规则；保存前统一 `sanitizeAttrs` 兜底
- 宿主保存：`setNodeMarkup(pos, undefined, newAttrs)` 写回节点；**保存前校验 `nodeAt(pos).type.name === nodeType`**（弹窗打开期间 undo/redo 可能使 pos 失效）

### 6.3 slash 插入与并组

[blocks.commands.ts](../src/renderer/components/editor/slash/commands/blocks.commands.ts) 的 `insertBlock(editor, pos, def)`：

1. `deleteSlashText` 删除 `/查询词`
2. **并组探测**：当前文本块已空（`$from.parent.content.size === 0`）且前一个同级块是同类分组时，插入点 = `$from.before(depth) - 1`（前邻分组 close 标记之前 = 组内内容末尾），直接把卡追加进组
3. 否则 `replaceSelectionWith` 创建新分组（与重载后文档结构一致，保证 round-trip 稳定）
4. 新节点位置通过**节点对象同一性**在事务后的文档中 `descendants` 定位（不依赖插入后光标落点），随后 `openBlockEditor` 自动打开弹窗

`buildBlocksGroup(t)` 由注册表生成 slash 命令组，新增块自动出现在 Slash 菜单。

### 6.4 注册接线（共 3 处）

| 位置 | 作用 |
| --- | --- |
| [extensions.ts](../src/renderer/components/editor/extensions.ts) | 模块加载时 `registerWrispBlockBridge(getBlocks())` + `getBlocks().flatMap(createBlockNodes)` 注入节点扩展 |
| [slash/commands/registry.ts](../src/renderer/components/editor/slash/commands/registry.ts) | `buildBlocksGroup(t)` 挂入命令组（新增块自动出现在菜单） |
| [App.vue](../src/renderer/App.vue) | 挂全局唯一 `BlockEditHost`（弹窗宿主） |

## 7. i18n

块定义只声明 key，文案集中在 [zhCN.ts](../src/shared/i18n/locales/zhCN.ts) / [enUS.ts](../src/shared/i18n/locales/enUS.ts) 的 `EDITOR.BLOCKS` 下：

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

## 8. 新增一个自定义数据块的步骤

以新增 `:::quote` 引用卡为例：

1. **定义块**：新建 `src/renderer/components/editor/blocks/definitions/quote.ts`，导出 `WrispBlockDefinition`（type/mdName/fields/组件/i18n key）
2. **视图组件**：在 `components/` 新建 `QuoteCardView.vue`（必选）与 `QuoteGroupView.vue`（需要归组布局时），模板用 `NodeViewWrapper`，编辑入口调 `openBlockEditor`
3. **注册**：在 `registry.ts` 的 `blocks` 数组追加一行——marked 桥接、Tiptap 节点、弹窗表单、slash 命令全部自动生效
4. **i18n**：两个 locale 文件补 `EDITOR.BLOCKS.QUOTE.*` 文案
5. **测试**：在 `tests/unit/renderer/blocks/round-trip.test.ts` 补该块的 round-trip / 清洗 / 归组用例

无需改动 extensions.ts、registry.ts（slash）、App.vue、TiptapEditor.vue——声明式注册表已驱动全部接线。

## 9. 测试

[round-trip.test.ts](../tests/unit/renderer/blocks/round-trip.test.ts)（35 个用例）覆盖：

- **解析**：围栏 → 桥接 HTML 断言（`data-wrisp-block-group`/`data-wrisp-block`/`data-f-*`）→ 节点结构与 attrs
- **清洗**：非法枚举回退默认值、未知字段丢弃
- **序列化**：默认值字段省略、round-trip 幂等（加载→序列化→再加载→再序列化结果一致）
- **归组**：连续围栏归单组、空行分隔的同类围栏仍归一组、卡片与段落间空行正常分隔
- **降级**：未闭合围栏回退普通文本、段落内围栏提前断段不吞内容
- **插入**：slash 插入定位/自动开弹窗、连续插入并入前邻分组（含"卡片必须在组内"结构断言）、段落含其他文本时独立成组
- **追加**：分组末尾 addCard 默认 attrs 来自 schema、结构保持

测试环境 NodeView 打桩：传入 `CardStub`/`GroupStub` 渲染桩组件，避免挂载真实 Vue 组件（i18n / naive-ui 依赖）。

运行：`pnpm vitest run tests/unit/renderer/blocks/`

## 10. 关键经验（踩坑记录）

1. **归组语义选型**：曾把"空行 = 组边界"作为归组规则，结果用户保存的 md 里卡片间有空行，4 张卡解析成 4 个独立分组竖排，看起来像"样式坏了"。**布局型块的归组不应依赖空行**——同类围栏总是归为一组，分行交给 flex 布局，空行只分隔卡片与普通内容
2. **ProseMirror 分组插入位置**：向分组追加卡片的插入点必须是**组内内容末尾（close 标记之前）**。`prevStart + 1 + prev.content.size` 这种"分组结束位置"是父容器层级，卡片会插到组外成为裸节点——裸卡片不参与组内 flex 布局，且后续插入因前邻不再是分组而无法并组，越插越散
3. **兄弟索引的深度**：`$from.index(depth)` 是块内子节点索引，`$from.index(depth - 1)` 才是当前块在父容器中的兄弟索引
4. **文本块边界扫描**：`doc.textBetween` 在节点边界返回空串 `""`（不是 `\n`），扫描循环必须以 `""` 为终止条件；反向查找以 `doc.resolve(pos).start()` 为下界，固定长度窗口会跨进前一区块
5. **弹窗期间文档可能变动**：编辑弹窗打开期间用户可 undo/redo，保存前必须校验 `nodeAt(pos)` 仍是目标类型再 `setNodeMarkup`
6. **新节点定位用对象同一性**：插入后光标落点在空段落/段落中部等上下文下并不确定，用「节点对象引用相等」在事务后文档中 `descendants` 定位才可靠
7. **NodeView 的 scoped 样式**：@tiptap/vue-3 的 VueNodeView 通过 `__scopeId` 显式支持 scoped styles，跨 `render()` 裸挂载也正常继承 scopeId，无需把样式改成全局
8. **卡片的跨组件布局归父容器管**：卡片组件自身只做 `display: inline-flex`，flex 拉伸/约束（`flex: 1 1 calc(...)`、`max-width`、`margin: 0`）统一由分组容器的 `:deep(.metric-card-wrap)` 控制，避免子组件 scoped 样式与父容器布局打架

## 11. 文件清单

```
src/renderer/components/editor/blocks/
├── registry.ts                 # 块定义类型 + 注册表（新增块在此追加）
├── definitions/
│   └── metric.ts               # 指标卡块定义
├── engine/
│   ├── md-codec.ts             # 字段行编解码 + 校验回退 + 确定性序列化
│   ├── marked-bridge.ts        # :::name → 桥接 HTML（内存管线，不落盘）
│   └── node-factory.ts         # Tiptap 节点扩展工厂（atom 卡 + 分组容器）
└── components/
    ├── MetricCardView.vue      # 卡片 NodeView
    ├── MetricGroupView.vue     # 分组容器 NodeView（flex 3 列布局 + addCard）
    ├── BlockEditModal.vue      # schema 驱动的编辑弹窗表单
    ├── BlockEditHost.vue       # 全局唯一弹窗宿主（消费总线请求 + 保存落盘）
    └── bus.ts                  # 弹窗编辑请求总线（全进程单例）

src/renderer/components/editor/
├── extensions.ts               # registerWrispBlockBridge + createBlockNodes 接线
├── App.vue                     # 挂载全局 BlockEditHost
└── slash/commands/
    ├── blocks.commands.ts      # insertBlock（并组探测 + 定位 + 开弹窗）
    └── registry.ts             # buildBlocksGroup 挂入 slash 命令组

src/shared/i18n/locales/
├── zhCN.ts / enUS.ts           # EDITOR.BLOCKS.* 文案

tests/unit/renderer/blocks/
└── round-trip.test.ts          # 35 个用例：解析/清洗/序列化/归组/插入/追加
```
