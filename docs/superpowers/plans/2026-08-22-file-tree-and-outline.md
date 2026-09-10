# 文件树 + 内容大纲面板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `src/renderer/components/project/` 下新建多层级文件树组件（含悬浮操作按钮 + 独立操作 Modal），并改造 `OutlineTree.vue` 为右侧内容大纲面板（3 级大纲、默认收起、点击定位）。两者集成进 `PageView.vue`。

**Architecture:**

- 文件树：递归组件 `FileTreeNode.vue`（渲染行 + 悬浮按钮）+ 容器 `FileTree.vue`（标题栏 + 一级添加 + 操作 Modal 编排）+ `PageOperationModal.vue`（移动到/删除）。
- 大纲：`OutlineTree.vue` 重写为右侧自管理收起/展开的面板；大纲数据由编辑区（`PageBlock` → `TiptapEditor.getOutline`）向上抛出，点击条目回调 `PageBlock.scrollToOutline(pos)` 实现定位。
- 数据能力补齐（主进程）：`PageService.createPage` 落 `order_index`、`movePage` 新增 IPC、`deletePage` 级联清理 md 文件（DB 层 `ON DELETE CASCADE` 已存在）。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript strict、Pinia、Naive UI（全局注册，模板中直接用）、Vue i18n、better-sqlite3、Vitest。

---

## 现状与关键决策

**现状（已核实）：**

- `page.service.ts` 的 `createPage` 写死 `order_index: 0`（子节点同级顺序无法保证）；无 `movePage`；`deletePage` 只删单页，不清理子页 md 文件（DB 层 `pages.parent_page_id REFERENCES pages(id) ON DELETE CASCADE` 会自动删记录，但 md 文件成孤儿）。
- `pages` 表已含 `parent_page_id`、`order_index` 字段，`BaseDao.findBy('parent_page_id', id)` 按 order 排序返回子节点。
- 渲染进程已有 `usePage` 的 `createPage` / `deletePage` / `getPageTree`；缺 `movePage`。
- `TiptapEditor.vue` 内容结构为 `doc.content[]`（顶层 blocks，含 `type: 'heading'` 与 `attrs.level`）；`PageBlock.vue` 用 `TiptapEditor` 并 ref 持有 editor。
- Naive UI 组件经 `plugins/naive-ui.ts` 全局注册（NLayout/NLayoutSider/NButton/NIcon/NScrollbar/NModal/NSelect/NPopconfirm/NEmpty/NFlex 均在列），模板中无需 import。
- `PageView.vue` 当前用 `n-layout-sider` 放作品信息 + 旧版 `OutlineTree`（左文件树），右侧无大纲面板。
- `TIPS.PROJECT.OUTLINE.EMPTY`（"No files yet"）、`TIPS.PAGE.NO_PAGE_SELECTED` 已存在，文件树空态复用前者。

**关键决策：**

1. 左侧边栏收起用 `n-layout-sider` `collapsible` + `collapsed-width="48"` + `show-trigger`（宽度 0 时 trigger 可能被裁剪，48px 收起条最稳妥，默认展开）。
2. 右侧大纲面板不用 `n-layout-sider`，由 `OutlineTree.vue` 内部自管收起（默认收起），收起时显示一条窄条 + 「大纲」按钮，展开为完整面板——保证收起状态下切换按钮始终可见。
3. 大纲仅取 1–3 级 heading（`level <= 3` 过滤），`OutlineItem` 类型放 `src/shared/types/page.types.ts`（editor 与 renderer 共用）。
4. `movePage` 的 `parentId` 用 `null` 表示移动到根；Modal 里「根目录」选项 value 用空字符串 `""` 表示根，emit 时归一化为 `null`。
5. 移动/删除动作在 `FileTree.vue` 编排（调用 usePage），`PageOperationModal.vue` 只负责展示与 emit（presentational），保持 Modal 可独立复用。
6. 删除依赖 DB `ON DELETE CASCADE`：服务端先收集并删除所有后代 md 文件，再删除单条记录即可级联。
7. 文件树数据变化（增/删/移）后 `FileTree` emit `changed`，`PageView` 重新 `getPageTree` 并刷新作品 `page_count`。

---

## 文件结构

**新增文件：**

- `src/renderer/components/project/FileTree.vue` — 文件树容器：标题栏（「目录」+ 一级添加按钮）、递归渲染、操作 Modal 编排、usePage 数据操作（CREATE）
- `src/renderer/components/project/FileTreeNode.vue` — 文件树行：折叠箭头 + 标题 + 悬浮操作按钮（添加子页 / 更多），递归渲染子节点（CREATE）
- `src/renderer/components/project/PageOperationModal.vue` — 文件操作 Modal：移动到（下拉选父级）+ 删除（Popconfirm）（CREATE）
- `tests/integration/main/page.service.test.ts` — movePage / 级联删除 / createPage 顺序 集成测试（CREATE）

**修改文件：**

- `src/shared/types/page.types.ts` — 新增 `MovePageInput`、`PageOutlineItem`（MODIFY）
- `src/shared/enums/errorCode.enums.ts` — 新增 `PAGE_MOVE_FAILED`（MODIFY，需与 `utils/response.ts` 错误文案对应）
- `src/main/core/services/page.service.ts` — `createPage` 写 order_index、新增 `movePage`、`deletePage` 级联清理 md（MODIFY）
- `src/main/core/apis/page.api.ts` — 新增 `movePage`（MODIFY）
- `src/main/ipcMain/page.ipc.ts` — 注册 `page:move` handler（MODIFY）
- `src/main/preload/modules/page.ts` + `src/main/preload/types/page.ts` — 暴露 `page.move`（MODIFY）
- `src/renderer/store/page.store.ts` + `src/renderer/composables/usePage.ts` — 新增 `movePage`（MODIFY）
- `src/renderer/components/editor/TiptapEditor.vue` — 新增 `getOutline()`（MODIFY）
- `src/renderer/components/editor/PageBlock.vue` — 加载后 emit `outline` 事件 + `defineExpose` 暴露 `scrollToOutline`（MODIFY）
- `src/renderer/components/project/OutlineTree.vue` — 重写为右侧内容大纲面板（REWRITE）
- `src/renderer/views/PageView.vue` — 左侧 `n-layout-sider` 可收起 + 引入 `FileTree` + 右侧 `OutlineTree` 大纲面板 + 数据联动（MODIFY）
- `src/shared/i18n/locales/zhCN.ts`、`enUS.ts` — 新增键（MODIFY，必须成对）

---

### Task 1: 共享类型与错误码

**Files:**

- Modify: `src/shared/types/page.types.ts`
- Modify: `src/shared/enums/errorCode.enums.ts`

- [ ] **Step 1: 新增 `MovePageInput` 与 `PageOutlineItem`**

在 `page.types.ts` 的 Page 相关 input 区新增：

```ts
/** 移动页面入参（parentId 为 null 表示移到根） */
export interface MovePageInput {
  id: PageId;
  parentId: PageId | null;
}

/** 大纲条目（1-3 级标题） */
export interface PageOutlineItem {
  level: 1 | 2 | 3;
  text: string;
  /** 在文档中的位置，用于滚动定位 */
  pos: number;
}
```

- [ ] **Step 2: 新增错误码**

在 `errorCode.enums.ts` 的 PAGE 枚举组中新增 `PAGE_MOVE_FAILED`（值形如 `'PAGE_MOVE_FAILED'`，与现有 `PAGE_DELETE_FAILED` 相邻）。

**Exit checklist:** `pnpm typecheck` 通过（此阶段不产生编译错）。

---

### Task 2: PageService 数据能力

**Files:**

- Modify: `src/main/core/services/page.service.ts`
- Create: `tests/integration/main/page.service.test.ts`

- [ ] **Step 1: `createPage` 写入 order_index**

将 `createPage` 中 `order_index: 0` 改为：

```ts
order_index: this.pageDao.getMaxOrderIndex(data.projectId, data.parentId) + 1,
```

（`getMaxOrderIndex(projectId, parentPageId)` 已是 DAO 既有方法，`parentId` 传 `data.parentId ?? null`。）

- [ ] **Step 2: 新增 `movePage`**

```ts
/** 移动页面到指定父级（parentId 为 null 移到根），同级末尾追加 */
public movePage(data: MovePageInput): number {
  const existing = this.pageDao.findById(data.id);
  if (!existing) return 0;
  const parentId = data.parentId ?? null;
  const orderIndex = this.pageDao.getMaxOrderIndex(existing.project_id ?? "", parentId) + 1;
  const pageUpdate: PageUpdate = {
    parent_page_id: parentId,
    order_index: orderIndex,
  };
  return this.pageDao.update(data.id, pageUpdate);
}
```

（需要 `MovePageInput` import；`PageUpdate` 已含 `parent_page_id` / `order_index` 字段。）

- [ ] **Step 3: `deletePage` 级联清理 md 文件**

```ts
/** 收集某页所有后代页的 file_path（含间接后代） */
private collectDescendantFilePaths(id: string): string[] {
  const paths: string[] = [];
  const visit = (pid: string) => {
    for (const child of this.pageDao.findBy("parent_page_id", pid)) {
      paths.push(child.file_path);
      visit(child.id);
    }
  };
  visit(id);
  return paths;
}

/** 删除页面：DB 层 ON DELETE CASCADE 删记录，此处负责清理自身与所有后代的 md 文件 */
public deletePage(id: string): number {
  const existing = this.pageDao.findById(id);
  if (!existing) return 0;
  const paths = this.collectDescendantFilePaths(id);
  for (const filePath of paths) {
    if (fileService.exists(filePath)) fileService.remove(filePath);
  }
  if (fileService.exists(existing.file_path)) fileService.remove(existing.file_path);
  return this.pageDao.delete(id);
}
```

- [ ] **Step 4: 集成测试**

新建 `tests/integration/main/page.service.test.ts`，参照 `project.dao.test.ts` 的 mock 模式（`@vitest-environment node`、mock electron/logger/winston、in-memory DB 跑 `init.sql`、mock `fileService`）：

- `movePage` 把子页挂到另一个父级，`getPageTree` 中位置正确；`movePage(null)` 移到根。
- `deletePage` 删除有子页的页面：子页记录被级联删除（`findById` 返回 null）、mock 的 `fileService.remove` 被调用且路径包含父/子 md 路径。
- `createPage` 连续创建 3 个子页，`order_index` 依次递增。

**Exit checklist:** `pnpm test` 通过；`pnpm typecheck` 通过。

---

### Task 3: IPC 4 层接线 movePage

**Files:**

- Modify: `src/main/core/apis/page.api.ts`
- Modify: `src/main/ipcMain/page.ipc.ts`
- Modify: `src/main/preload/modules/page.ts`
- Modify: `src/main/preload/types/page.ts`
- Modify: `src/renderer/store/page.store.ts`
- Modify: `src/renderer/composables/usePage.ts`

- [ ] **Step 1: core API**

`page.api.ts` 使用独立函数 + `response.success/error` 模式（参照现有 `deletePage`，已核实 `src/main/core/apis/page.api.ts#L84-L104`）：

```ts
async function movePage(data: MovePageInput): Promise<ApiResponse<number>> {
  try {
    const changes = pageService.movePage(data);
    if (changes > 0) {
      return response.success(changes);
    } else {
      return response.error(ErrorCode.PAGE_NOT_FOUND);
    }
  } catch (error) {
    Logger.error("移动页面失败", { error: JSON.stringify(error), data });
    return response.error(ErrorCode.PAGE_MOVE_FAILED, error as Error);
  }
}
```

并在文件末尾 `export { ... }` 块中加入 `movePage`（同时确认顶部已 import `MovePageInput` 与 `ErrorCode`）。

- [ ] **Step 2: ipcMain handler**

在 `page.ipc.ts` 注册：

```ts
ipcMain.handle("page:move", (_event, data: MovePageInput) => {
  return this.pageApi.movePage(data);
});
```

（参数由 preload 做基本校验，参照现有 `page:delete` handler 的写法。）

- [ ] **Step 3: preload module + type**

`preload/types/page.ts` 增加 `move: (data: MovePageInput) => Promise<ApiResponse<number>>`；`preload/modules/page.ts` 增加：

```ts
move: (data) => ipcRenderer.invoke("page:move", data),
```

- [ ] **Step 4: store + composable**

`page.store.ts` 仿照 `deletePage` 增加 `movePage` action（成功返回影响行数，失败写入 `errorCode`/`errorMessage` 并返回 null）；`usePage.ts` 中返回 `movePage`。

**Exit checklist:** `pnpm typecheck` 通过；`pnpm test` 通过。

---

### Task 4: i18n 键补充

**Files:**

- Modify: `src/shared/i18n/locales/zhCN.ts`
- Modify: `src/shared/i18n/locales/enUS.ts`

- [ ] **Step 1: 新增键（两语言成对）**

| key                        | enUS                                       | zhCN                             |
| -------------------------- | ------------------------------------------ | -------------------------------- |
| `APP.BASE.CATALOG`         | `Contents`                                 | `目录`                           |
| `APP.BASE.MORE`            | `More`                                     | `更多`                           |
| `APP.BASE.MOVE_TO`         | `Move to`                                  | `移动到`                         |
| `APP.BASE.ROOT`            | `Root`                                     | `根目录`                         |
| `TIPS.PAGE.NEW_CHAPTER`    | `New Chapter`                              | `新章节`                         |
| `TIPS.PAGE.CONFIRM_DELETE` | `Delete this page? This cannot be undone.` | `确定删除该页面？删除后不可恢复` |
| `TIPS.PAGE.OUTLINE_EMPTY`  | `No outline yet`                           | `暂无大纲`                       |
| `ERROR.PAGE.MOVE_FAILED`   | `Failed to move page`                      | `移动页面失败`                   |

`APP.BASE` 键插在 `OUTLINE` 附近；`TIPS.PAGE.*` 插在 `NO_PAGE_SELECTED` 附近；`ERROR.PAGE.MOVE_FAILED` 插在 `DELETE_FAILED` 之后。

**Exit checklist:** `pnpm test`（`locale-keys` 一致性测试）通过。

---

### Task 5: 编辑器大纲能力

**Files:**

- Modify: `src/renderer/components/editor/TiptapEditor.vue`
- Modify: `src/renderer/components/editor/PageBlock.vue`

- [ ] **Step 1: TiptapEditor.getOutline**

`TiptapEditor.vue` 中编辑器实例为 `useEditor` 返回的 `editor`（ShallowRef），代码统一走 `editor.value`；`defineExpose({ focus, clear, getHTML, getMarkdown, getText, editor })` 在文件末尾（已核实 `src/renderer/components/editor/TiptapEditor.vue#L306`）。新增：

```ts
import type { PageOutlineItem } from "@/shared/types/page.types";

/** 提取 1-3 级标题大纲（编辑器就绪后调用） */
function getOutline(): PageOutlineItem[] {
  const ed = editor.value;
  if (!ed) return [];
  const items: PageOutlineItem[] = [];
  let index = 0;
  for (const block of ed.state.doc.content) {
    if (block.type.name === "heading" && (block.attrs.level as number) <= 3) {
      items.push({
        level: block.attrs.level as 1 | 2 | 3,
        text: block.textContent,
        pos: index,
      });
    }
    index += 1;
  }
  return items;
}
```

并把 `getOutline` 追加进 `defineExpose` 列表（保持暴露 API 统一）。

- [ ] **Step 2: PageBlock 抛出 outline + 暴露 scrollToOutline**

`PageBlock.vue` 已用 `ref="editorRef"` 持有 TiptapEditor 实例、已有 `defineEmits`（`saved`）与 `watch` 导入（已核实 `src/renderer/components/editor/PageBlock.vue#L25-L40`）。修改：

```ts
const emit = defineEmits<{
  (e: "saved", pageId: string): void;
  (e: "outline", items: PageOutlineItem[]): void;
}>();

/** 内容变化（含加载后 setContent）→ 重新抛出大纲 */
watch(editContent, async () => {
  await nextTick();
  emit("outline", editorRef.value?.getOutline() ?? []);
});

/** 大纲点击定位：滚动到对应标题位置 */
function scrollToOutline(pos: number) {
  const ed = editorRef.value?.editor; // defineExpose 自动解包 ref，得到 Editor 实例
  if (ed) ed.commands.focus(pos);
}

defineExpose({ scrollToOutline });
```

说明：TiptapEditor 的 `setContent(..., { emitUpdate: true })` 会触发 `update:modelValue` → `editContent` 更新 → 上面的 `watch(editContent)` 在加载与编辑时都会触发，且此时编辑器 doc 已就绪，`getOutline()` 结果可靠。需在 import 中补 `nextTick` 与 `PageOutlineItem`。

**Exit checklist:** `pnpm typecheck` 通过。

---

### Task 6: 重写 OutlineTree.vue 为右侧内容大纲

**Files:**

- Rewrite: `src/renderer/components/project/OutlineTree.vue`

- [ ] **Step 1: 重写组件**

```vue
<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import type { PageOutlineItem } from "@/shared/types/page.types";

withDefaults(
  defineProps<{
    title?: string;
    items?: PageOutlineItem[];
  }>(),
  { title: "", items: () => [] },
);

const emit = defineEmits<{
  (e: "select", item: PageOutlineItem): void;
}>();

const { t } = useI18n();

/** 默认收起 */
const collapsed = ref(true);

function handleSelect(item: PageOutlineItem) {
  emit("select", item);
}
</script>

<template>
  <aside class="outline-panel" :class="{ collapsed }">
    <!-- 收起态：窄条 + 展开按钮 -->
    <div
      v-if="collapsed"
      class="outline-collapsed-bar"
      :title="t('APP.BASE.OUTLINE')"
      @click="collapsed = false"
    >
      <n-icon size="16"><BookOutline /></n-icon>
      <span>{{ t("APP.BASE.OUTLINE") }}</span>
    </div>

    <!-- 展开态：标题栏 + 条目列表 -->
    <div v-else class="outline-expanded">
      <div class="outline-header">
        <span class="outline-title">{{ title || t("APP.BASE.OUTLINE") }}</span>
        <n-button
          quaternary
          circle
          size="tiny"
          :title="t('ACTION.COMMON.CANCEL')"
          @click="collapsed = true"
        >
          <template #icon
            ><n-icon size="14"><ChevronForward /></n-icon
          ></template>
        </n-button>
      </div>
      <n-scrollbar v-if="items.length" class="outline-body">
        <div
          v-for="(item, index) in items"
          :key="index"
          class="outline-item"
          :class="`level-${item.level}`"
          :style="{ paddingLeft: (item.level - 1) * 14 + 8 + 'px' }"
          :title="item.text"
          @click="handleSelect(item)"
        >
          {{ item.text }}
        </div>
      </n-scrollbar>
      <n-empty
        v-else
        class="outline-empty"
        :description="t('TIPS.PAGE.OUTLINE_EMPTY')"
        size="small"
      />
    </div>
  </aside>
</template>

<style scoped lang="scss">
.outline-panel {
  position: relative;
  border-left: 1px solid var(--border-color);
  background: var(--bg-1);
  height: 100%;
  display: flex;
  flex-direction: column;
}
.outline-collapsed-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px 4px;
  writing-mode: vertical-rl;
  cursor: pointer;
  color: var(--text-2);
  user-select: none;
  &:hover {
    color: var(--text-1);
    background: var(--bg-2);
  }
}
.outline-expanded {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 220px;
}
.outline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}
.outline-title {
  font-weight: 600;
  font-size: 14px;
}
.outline-body {
  flex: 1;
  padding: 4px 0;
}
.outline-item {
  padding: 3px 8px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-2);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  &:hover {
    color: var(--text-1);
    background: var(--bg-2);
  }
  &.level-2 {
    font-weight: 500;
  }
  &.level-3 {
    color: var(--text-3);
  }
}
.outline-empty {
  padding: 16px 0;
}
</style>
```

（`BookOutline` / `ChevronForward` 来自 `@vicons/ionicons5`，在 script 中 import。）

- [ ] **Step 2: 视觉自查**

在 `pnpm dev` 下临时将 `OutlineTree` 挂到 `PageView` 右侧，确认：默认收起（只显示窄条）、点击展开、展开后显示 1-3 级缩进大纲、点击条目触发 `select` 事件、空态文案正确。

**Exit checklist:** 交互符合「默认收起 / 展开 / 点击定位事件」。

---

### Task 7: 新建 PageOperationModal.vue

**Files:**

- Create: `src/renderer/components/project/PageOperationModal.vue`

- [ ] **Step 1: 创建 Modal（移动到 + 删除）**

```vue
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { PageTree } from "@/main/types/db";

const props = withDefaults(
  defineProps<{
    show: boolean;
    page: PageTree | null;
    treeNodes?: PageTree[];
    /** 用于 move 后刷新，仅声明透传 */
    projectId?: string;
  }>(),
  { treeNodes: () => [], projectId: "" },
);

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "moved", pageId: string, parentId: string | null): void;
  (e: "deleted", pageId: string): void;
}>();

const { t } = useI18n();

const ROOT = "__ROOT__";
const targetParent = ref<string>(ROOT);

/** 排除自身及所有后代的 id */
function collectExcluded(node: PageTree, acc: string[]): string[] {
  acc.push(node.id);
  for (const child of node.children ?? []) collectExcluded(child, acc);
  return acc;
}

/** 展开为 { label, value, disabled } 列表 */
function flatten(
  nodes: PageTree[],
  excluded: Set<string>,
  depth = 0,
): { label: string; value: string; disabled: boolean }[] {
  const result: { label: string; value: string; disabled: boolean }[] = [];
  for (const node of nodes) {
    const disabled = excluded.has(node.id);
    result.push({
      label: `${"　".repeat(depth)}${node.title}`,
      value: node.id,
      disabled,
    });
    result.push(...flatten(node.children ?? [], excluded, depth + 1));
  }
  return result;
}

const moveOptions = computed(() => {
  if (!props.page) return [];
  const excluded = new Set(collectExcluded(props.page, []));
  return [
    { label: t("APP.BASE.ROOT"), value: ROOT, disabled: false },
    ...flatten(props.treeNodes, excluded),
  ];
});

const selectOptions = computed(() => ({
  options: moveOptions.value,
  value: targetParent.value,
  onUpdateValue: (v: string) => (targetParent.value = v),
}));

watch(
  () => props.show,
  (visible) => {
    if (visible) targetParent.value = ROOT;
  },
);

function handleMove() {
  if (!props.page) return;
  emit(
    "moved",
    props.page.id,
    targetParent.value === ROOT ? null : targetParent.value,
  );
}

function handleDelete() {
  if (!props.page) return;
  emit("deleted", props.page.id);
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    :title="page?.title ?? t('APP.BASE.MORE')"
    style="width: 420px"
    @update:show="emit('update:show', $event)"
  >
    <n-flex vertical size="large">
      <!-- 移动到 -->
      <n-form-item :label="t('APP.BASE.MOVE_TO')">
        <n-select v-bind="selectOptions" filterable clearable />
      </n-form-item>
      <!-- 删除 -->
      <n-popconfirm
        :positive-text="t('ACTION.COMMON.DELETE')"
        :negative-text="t('ACTION.COMMON.CANCEL')"
        @positive-click="handleDelete"
      >
        <template #trigger>
          <n-button type="error" block>{{
            t("ACTION.COMMON.DELETE")
          }}</n-button>
        </template>
        {{ t("TIPS.PAGE.CONFIRM_DELETE") }}
      </n-popconfirm>
    </n-flex>
    <template #footer>
      <n-space justify="end">
        <n-button @click="emit('update:show', false)">{{
          t("ACTION.COMMON.CANCEL")
        }}</n-button>
        <n-button type="primary" @click="handleMove">{{
          t("ACTION.COMMON.CONFIRM")
        }}</n-button>
      </n-space>
    </template>
  </n-modal>
</template>
```

（`PageTree` 从 `@/main/types/db` import，沿用现网；`n-form-item` 需在 `plugins/naive-ui.ts` 已注册列表内——已确认在列。）

- [ ] **Step 2: 说明**

Modal 只做展示与 emit；`moved`/`deleted` 由 `FileTree.vue` 处理真实操作并关闭。root 选项用 `__ROOT__` 哨兵值避免与真实 id 冲突。

**Exit checklist:** `pnpm typecheck` 通过；Modal 布局、禁用自身/后代项正确。

---

### Task 8: 新建 FileTree + FileTreeNode

**Files:**

- Create: `src/renderer/components/project/FileTreeNode.vue`
- Create: `src/renderer/components/project/FileTree.vue`

- [ ] **Step 1: FileTreeNode（递归行）**

```vue
<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  Add,
  EllipsisHorizontal,
  ChevronForward,
  ChevronDown,
} from "@vicons/ionicons5";
import type { PageTree } from "@/main/types/db";

defineProps<{
  node: PageTree;
  depth: number;
  selectedKey: string | null;
}>();

const emit = defineEmits<{
  (e: "select", id: string): void;
  (e: "create", parentId: string): void;
  (e: "more", node: PageTree): void;
}>();

const { t } = useI18n();
const expanded = ref(false);
</script>

<template>
  <div>
    <div
      class="file-node"
      :class="{
        selected: node.id === selectedKey,
        'has-children': !!node.children?.length,
      }"
      :style="{ paddingLeft: depth * 16 + 8 + 'px' }"
      @click.stop="emit('select', node.id)"
    >
      <span
        v-if="node.children?.length"
        class="file-node-caret"
        @click.stop="expanded = !expanded"
      >
        <n-icon size="12"
          ><ChevronForward v-if="!expanded" /><ChevronDown v-else
        /></n-icon>
      </span>
      <span v-else class="file-node-caret file-node-caret--empty" />
      <span class="file-node-title" :title="node.title">{{ node.title }}</span>
      <span class="file-node-actions">
        <button
          class="file-node-action"
          :title="t('APP.BASE.MORE')"
          @click.stop="emit('more', node)"
        >
          <n-icon size="14"><EllipsisHorizontal /></n-icon>
        </button>
        <button
          class="file-node-action"
          :title="t('ACTION.COMMON.ADD')"
          @click.stop="emit('create', node.id)"
        >
          <n-icon size="14"><Add /></n-icon>
        </button>
      </span>
    </div>
    <template v-if="expanded && node.children?.length">
      <FileTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :selected-key="selectedKey"
        @select="emit('select', $event)"
        @create="emit('create', $event)"
        @more="emit('more', $event)"
      />
    </template>
  </div>
</template>

<style scoped lang="scss">
.file-node {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-top: 4px;
  padding-bottom: 4px;
  padding-right: 8px;
  cursor: pointer;
  color: var(--text-2);
  border-radius: 4px;
  &:hover {
    background: var(--bg-2);
    color: var(--text-1);
  }
  &.selected {
    background: var(--primary-color-soft);
    color: var(--primary-color);
  }
}
.file-node-caret {
  display: inline-flex;
  flex-shrink: 0;
  width: 16px;
}
.file-node-caret--empty {
  width: 16px;
}
.file-node-title {
  flex: 1;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.file-node-actions {
  display: none;
  flex-shrink: 0;
  gap: 2px;
}
.file-node:hover .file-node-actions,
.file-node.selected .file-node-actions {
  display: inline-flex;
}
.file-node-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-3);
  border-radius: 4px;
  &:hover {
    color: var(--primary-color);
    background: var(--bg-3);
  }
}
</style>
```

（`FileTreeNode` 在 script-setup 中按文件名隐式自引用，无需注册。）

- [ ] **Step 2: FileTree（容器）**

```vue
<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { Add } from "@vicons/ionicons5";
import type { PageTree } from "@/main/types/db";
import { PAGE_TYPE } from "@/shared/enums";
import { usePage } from "@/renderer/composables/usePage";
import FileTreeNode from "./FileTreeNode.vue";
import PageOperationModal from "./PageOperationModal.vue";

const props = withDefaults(
  defineProps<{
    projectId: string;
    nodes: PageTree[];
    selectedKey?: string | null;
  }>(),
  { selectedKey: null },
);

const emit = defineEmits<{
  (e: "select", id: string): void;
  (e: "changed"): void;
}>();

const { t } = useI18n();
const { createPage, deletePage, movePage } = usePage();

const operationVisible = ref(false);
const operationPage = ref<PageTree | null>(null);

async function createPageNode(parentId: string | null) {
  const id = await createPage({
    projectId: props.projectId,
    parentId,
    pageType: PAGE_TYPE.PROJECT_CHAPTER,
    title: t("TIPS.PAGE.NEW_CHAPTER"),
    content: "",
  });
  if (id) emit("changed");
}

function handleMore(node: PageTree) {
  operationPage.value = node;
  operationVisible.value = true;
}

async function handleMoved(pageId: string, parentId: string | null) {
  await movePage({ id: pageId, parentId });
  operationVisible.value = false;
  emit("changed");
}

async function handleDeleted(pageId: string) {
  await deletePage(pageId);
  operationVisible.value = false;
  emit("changed");
}
</script>

<template>
  <div class="file-tree">
    <div class="file-tree-header">
      <span class="file-tree-title">{{ t("APP.BASE.CATALOG") }}</span>
      <n-button
        quaternary
        circle
        size="tiny"
        :title="t('ACTION.COMMON.ADD')"
        @click="createPageNode(null)"
      >
        <template #icon
          ><n-icon><Add /></n-icon
        ></template>
      </n-button>
    </div>
    <n-scrollbar class="file-tree-body">
      <div v-if="nodes.length === 0" class="file-tree-empty">
        {{ t("TIPS.PROJECT.OUTLINE.EMPTY") }}
      </div>
      <FileTreeNode
        v-for="node in nodes"
        :key="node.id"
        :node="node"
        :depth="0"
        :selected-key="selectedKey"
        @select="emit('select', $event)"
        @create="createPageNode"
        @more="handleMore"
      />
    </n-scrollbar>
    <PageOperationModal
      :show="operationVisible"
      :page="operationPage"
      :tree-nodes="nodes"
      :project-id="projectId"
      @update:show="operationVisible = $event"
      @moved="handleMoved"
      @deleted="handleDeleted"
    />
  </div>
</template>

<style scoped lang="scss">
.file-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.file-tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  flex-shrink: 0;
}
.file-tree-title {
  font-weight: 600;
  font-size: 13px;
}
.file-tree-body {
  flex: 1;
}
.file-tree-empty {
  padding: 16px;
  text-align: center;
  color: var(--text-3);
  font-size: 13px;
}
</style>
```

- [ ] **Step 3: 自查**

在 `PageView` 临时挂载：多级展开/收起、悬浮出现添加/更多按钮、添加子页后 `changed` 触发父级刷新、更多打开 Modal。

**Exit checklist:** 交互符合「多级 / 悬浮按钮 / 添加子页 / 更多弹窗」。

---

### Task 9: PageView 集成

**Files:**

- Modify: `src/renderer/views/PageView.vue`

- [ ] **Step 1: 左侧边栏可收起 + 引入 FileTree**

当前 `PageView.vue` 已通过 `usePage()` 取 store 的 `pageTree`，并用 `treeOptions` computed 转 `TreeOption` 喂旧版 `OutlineTree`。改造（已核实 `src/renderer/views/PageView.vue#L1-L120`）：

- 引入替换：

```ts
import FileTree from "@/renderer/components/project/FileTree.vue";
import OutlineTree from "@/renderer/components/project/OutlineTree.vue";
import PageBlock from "@/renderer/components/editor/PageBlock.vue";
import type { PageOutlineItem } from "@/shared/types/page.types";
// 移除 Naive UI 显式 import（插件已全局注册），移除 TreeOption / toTreeOption
```

- 左侧 `n-layout-sider` 加 `collapsible` + `collapsed-width="48"` + `show-trigger`（默认展开），内部作品信息不变，文件树替换为：

```vue
<FileTree
  :project-id="projectId"
  :nodes="pageTree ?? []"
  :selected-key="currentPageId"
  @select="handleSelect"
  @changed="handleTreeChanged"
/>
```

- `handleSelect`（现有）即设置 `currentPageId`，直接复用。
- `handleTreeChanged`：树增/删/移后刷新，同时刷新作品信息以更新 `page_count`：

```ts
const { getProjectDetail } = useProject();

const handleTreeChanged = () => {
  void getPageTree(projectId.value, PAGE_TYPE.PROJECT_CHAPTER);
  void getProjectDetail(projectId.value).then((detail) => {
    if (detail) project.value = detail;
  });
};
```

（`getPageTree` 更新 store 的 `pageTree`，`pageTree` computed 自动驱动 `FileTree` 的 `nodes`，无需本地副本。）

- [ ] **Step 2: 右侧大纲面板 + 定位**

- 右侧：`<OutlineTree :items="outlineItems" @select="handleOutlineSelect" />`（放在编辑区右侧，整体用 flex）。
- 状态与联动：

```ts
const outlineItems = ref<PageOutlineItem[]>([]);
const pageBlockRef = ref<InstanceType<typeof PageBlock> | null>(null);

function handleOutline(items: PageOutlineItem[]) {
  outlineItems.value = items;
}
function handleOutlineSelect(item: PageOutlineItem) {
  pageBlockRef.value?.scrollToOutline(item.pos);
}
// 切换页面时清空旧大纲
watch(currentPageId, () => {
  outlineItems.value = [];
});
```

- `PageBlock` 上加 `ref="pageBlockRef"`、`:pageID="currentPageId"`、`:key="currentPageId"`、`@outline="handleOutline"`。
- 布局：`n-layout` 内容区改为横向 flex——`[PageBlock 编辑区（flex:1）][OutlineTree（固定宽，默认收起为窄条）]`。

**Exit checklist:** 布局为「左栏（可收起：作品信息+文件树）| 编辑区 | 右侧大纲（默认收起）」，切换页面大纲清空并重建，点击大纲滚动定位。

---

### Task 10: 验证

**Files:**

- Verify: 全部改动文件

- [ ] **Step 1: 静态检查**

`pnpm typecheck`、`pnpm lint` 通过（无 unused var，遵循 strict）。

- [ ] **Step 2: 测试**

`pnpm test` 全绿（含新增 `page.service.test.ts` 与既有 `locale-keys` 一致性测试）。

- [ ] **Step 3: 手动验证**

`pnpm dev` 下走查：

1. 进入作品空间，左侧显示作品信息 + 目录树（标题栏「目录」+ 一级添加按钮）。
2. 悬浮文件行 → 出现「更多」「添加」按钮；「添加」在当前节点下新建子页并自动刷新树。
3. 「更多」→ Modal：移动到（下拉含「根目录」+ 其他页，禁用自身/后代）、删除（Popconfirm 二次确认）。
4. 删除含子页的页面：树刷新、md 文件被清理（子页记录级联删除）。
5. 左侧边栏可收起/展开。
6. 右侧大纲默认收起（窄条），点击展开显示 1-3 级缩进大纲；点击条目编辑区滚动定位到对应标题；切换页面后大纲清空并按新内容重建。

---

## 风险与兜底

- `n-layout-sider` 宽度 0 时 trigger 可能被裁剪 → 采用 `collapsed-width="48"` 收起条方案。
- **@vicons/ionicons5 命名陷阱**：包内不存在 `ChevronRight`（TS2305），右侧展开/收起图标一律用 `ChevronForward`（已验证 Task 6/8 引用的 `BookOutline`、`ChevronForward`、`ChevronDown`、`Add`、`EllipsisHorizontal` 均存在）。新增图标前先查 `node_modules/@vicons/ionicons5/lib/index.d.ts`。
- Tiptap `commands.focus(pos)` 若在目标版本不可用 → 兜底 `chain().focus().run()` + `tr.scrollIntoView()`。
- `PageTree` 类型路径 `@/main/types/db` 若与现网不一致 → 以 `getPageTree` 返回值实际类型为准（`pnpm typecheck` 兜底校验）。
