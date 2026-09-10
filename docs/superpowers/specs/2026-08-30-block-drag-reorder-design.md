# 块拖拽排序（Drag & Drop Block Reordering）设计文档

日期：2026-08-30
状态：已确认

## 目标

编辑器（页面正文、日记，即所有基于 `TiptapEditor.vue` 的编辑器）中的顶层块支持 Notion 风格拖拽排序：悬停显示 `⠿` 手柄，拖动显示蓝色插入线，松开完成移动。

## 需求

- 交互形态：Notion 风格（悬停手柄 + 蓝色插入线）
- 生效范围：全部 Tiptap 编辑器（页面编辑器 + 日记编辑器）
- 块类型：全部顶层块（段落、标题、代码块、图片、数学公式块、指标卡等）
- 拖拽目标：单块拖拽（不支持多选）
- 落点指示器：蓝色插入线（2px 圆角，主题主色）

## 方案选型

采用 **官方 DragHandle 扩展 + 自定义移动语义插件**：

- `@tiptap/extension-drag-handle`（MIT 开源，基于 floating-ui）负责手柄的悬停检测与浮动定位（自动处理滚动/resize/边界）
- 自研 ProseMirror 插件负责拖放语义：dragstart 记录、dragover 落点计算与插入线、drop 移动事务

理由：定位逻辑交由官方维护；落点计算、插入线 UI、移动事务贴合项目现有模式（Naive UI 主题、与自定义 NodeView 共存）自行掌控。

## 架构

```
extensions.ts                          ← 注册 createDragReorderExtension()
editor/drag-handle/
  ├── index.ts                         ← 对外导出 createDragReorderExtension()
  ├── drag-handle.ts                   ← 官方 DragHandle 配置（手柄 DOM 渲染、hover 检测）
  └── reorder-plugin.ts                ← PM 插件：拖放语义 + 插入线管理
styles/_markdown.scss                  ← 手柄与插入线样式（主题变量适配）
tests/unit/editor/drag-reorder.test.ts ← 移动事务逻辑测试
```

手柄采用纯 DOM 渲染（`render()` 返回带 SVG 图标的 div），不使用 Vue 组件包装——手柄无内部状态，纯 DOM 更轻且与官方扩展契合。

## 交互流程

1. **悬停**：鼠标进入顶层块 → 左侧浮现 `⠿` 手柄（主题色适配，与图片选中蓝描边风格统一）
2. **dragstart**（手柄上）：
   - `dataTransfer.setData('application/x-wrisp-drag-block', '1')`（自定义 mime，避免 PM 默认拖放产生"复制"语义）
   - `effectAllowed = 'move'`
   - 插件状态记录 `{ node, from, to }`（当前悬停块及其位置）
3. **dragover**：`view.posAtCoords({ left, top })` 找鼠标下方顶层块 → 按该块 DOM 矩形上/下半部判定插入"之前/之后" → 显示蓝色插入线；目标与原位置等价（无操作）时隐藏线；`preventDefault()` 使浏览器允许 drop
4. **drop**：单个 transaction 内 `delete(from, to)` → `tr.mapping.map(target)` 校正 → `insert(mappedTarget, node)` → `NodeSelection` 选中移动后的块（Cmd+Z 一步撤销；PM 无机会插入副本）
5. **dragend**：清理插件状态与插入线（在拖拽源元素上必然触发）

## 关键逻辑

### 落点计算

- 拖拽块与插入位置均为顶层（doc 直接子节点）→ schema 永远合法，无需父子关系校验
- 鼠标坐标 → `posAtCoords` → resolve 到顶层块 → DOM `getBoundingClientRect()` 上/下半部 → 目标边界 = `block.before` 或 `block.after`
- 空白区域（内容末尾下方）→ 落点为文档末尾
- 等价位置判定：目标 === `from` 或目标 === `to`（相邻前后无操作）→ 不显示插入线

### 位置映射（drop 事务）

```
tr.delete(from, to)
mappedTarget = tr.mapping.map(target)   // 目标在删除点之后时自动前移
tr.insert(mappedTarget, node)
tr.setSelection(NodeSelection.create(tr.doc, mappedTarget))
view.dispatch(tr)
```

### 自动滚动

拖动指针进入滚动容器边缘 40px 内 → rAF 循环滚动（8px/帧）。编辑器 maxHeight 滚动容器内的坐标由 `posAtCoords` 天然正确。

### 嵌套块

V1 拖拽整个顶层列表；不支持拖出单个列表项（后续可扩展）。手柄吸附顶层块。

## 插入线与手柄 UI

- 插入线：2px 高圆角水平线，宽度 = 编辑器内容区宽度，主题主色；挂载于 `.tiptap-editor-wrapper`（`position: relative`），随内容滚动，**不在 PM DOM 内**（规避 `ignoreMutation` 问题）
- 手柄：左缘垂直居中于悬停块；`editor.isEditable === false` 时手柄与插入线均隐藏
- 拖拽期间被拖块保持原位（不做半透明幽灵块，用户已选"插入线"方案）

## 与既有功能的交互

- 图片/代码块 NodeView：手柄在左缘、代码块工具栏在右上角，无重叠；图片 resize 手柄交互不受影响
- drop 后 NodeSelection 选中图片 → 按现有约定显示图片浮动工具栏（行为一致）
- SlashMenu/BubbleMenu：HTML5 拖拽不产生 click/textSelection，不触发
- `BlockEditor.vue` 为遗留未引用代码，不改动
- 数学公式块、指标卡等 atom/容器节点：作为顶层块整体拖拽，NodeView 无需感知

## 测试策略

- 纯逻辑单测（真实 EditorState + getExtensions()）：
  - 三块文档拖块 0 到块 2 之后 → 断言顺序、NodeSelection、撤销一步还原
  - 目标位置映射三类 case：前移（目标在删除点前）、后移（目标在删除点后需 -nodeSize）、无操作（相邻）
  - 拖拽图片/代码块等 atom 节点的移动
- DOM 事件部分（插入线定位、自动滚动）人工验证；既有测试套件回归

## 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 官方扩展 v3 小版本间 API 差异 | 实现时阅读已安装包源码确认选项 |
| 滚动容器内坐标系偏差 | 插入线挂载于同一滚动容器，`posAtCoords` 做绝对坐标映射 |
| 与自定义 NodeView 的 hover 竞争 | 手柄定位基于 hover 的顶层块 DOM，与 NodeView 内部交互（resize/工具栏）事件互不干扰 |
| drop 语义被 PM 默认行为拦截 | 自定义 mime 类型使 PM 不解析拖拽内容；`handleDrop` 返回 true 接管 |

## 非目标

- 多块批量拖拽
- 列表项跨层级拖拽（含拖入/拖出列表）
- 跨编辑器/跨页面拖拽块
- 拖拽幽灵块视觉（半透明预览）
