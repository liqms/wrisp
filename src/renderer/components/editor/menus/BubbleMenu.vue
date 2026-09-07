<template>
  <BubbleMenu v-if="editor" :editor="editor" :should-show="shouldShow" :options="{ placement: 'top', offset: 8 }"
    class="bubble-menu" :plugin-key="textBubblePluginKey">
    <div ref="toolbarRef" class="toolbar">
      <!-- 块类型 -->
      <button class="toolbar-btn toolbar-btn--wide" :class="{ 'is-active': isBlockActive }" title="块类型"
        @click="toggleDropdown('block')">
        <n-icon size="18">
          <TextFieldsOutlined />
        </n-icon>
        <n-icon size="14" class="chevron">
          <ExpandMoreOutlined />
        </n-icon>
      </button>

      <!-- 提示块类型（光标位于提示块内时显示） -->
      <button v-if="editor.isActive('admonition')" class="toolbar-btn toolbar-btn--wide"
        :class="{ 'is-active': openDropdown === 'admonitionType' }" title="提示块类型"
        @click="toggleDropdown('admonitionType')">
        <n-icon size="18">
          <component :is="currentAdmonitionIcon" />
        </n-icon>
        <n-icon size="14" class="chevron">
          <ExpandMoreOutlined />
        </n-icon>
      </button>

      <span class="toolbar-divider" />

      <!-- 对齐 -->
      <button class="toolbar-btn toolbar-btn--wide" :class="{ 'is-active': isAlignActive }" title="对齐"
        @click="toggleDropdown('align')">
        <n-icon size="18">
          <FormatAlignJustifyOutlined />
        </n-icon>
        <n-icon size="14" class="chevron">
          <ExpandMoreOutlined />
        </n-icon>
      </button>

      <span class="toolbar-divider" />

      <!-- 行内格式：粗体/删除/斜体/下划线 -->
      <button class="toolbar-btn" :class="{ 'is-active': editor.isActive('bold') }" title="加粗 (Ctrl+B)"
        @click="editor.chain().focus().toggleBold().run()">
        <span class="char-icon">B</span>
      </button>
      <button class="toolbar-btn" :class="{ 'is-active': editor.isActive('strike') }" title="删除线 (Ctrl+Shift+S)"
        @click="editor.chain().focus().toggleStrike().run()">
        <span class="char-icon char-icon--strike">S</span>
      </button>
      <button class="toolbar-btn" :class="{ 'is-active': editor.isActive('italic') }" title="斜体 (Ctrl+I)"
        @click="editor.chain().focus().toggleItalic().run()">
        <span class="char-icon char-icon--italic">I</span>
      </button>
      <button class="toolbar-btn" :class="{ 'is-active': editor.isActive('underline') }" title="下划线 (Ctrl+U)"
        @click="editor.chain().focus().toggleUnderline().run()">
        <span class="char-icon char-icon--underline">U</span>
      </button>

      <span class="toolbar-divider" />

      <!-- 链接 / 代码 / 高亮 / 注音 / 上下标 -->
      <button class="toolbar-btn" :class="{ 'is-active': editor.isActive('link') }" title="链接 (Ctrl+K)"
        @click="handleLink">
        <n-icon size="18">
          <LinkOutlined />
        </n-icon>
      </button>
      <button class="toolbar-btn" :class="{ 'is-active': editor.isActive('code') }" title="行内代码 (Ctrl+E)"
        @click="editor.chain().focus().toggleCode().run()">
        <n-icon size="18">
          <CodeOutlined />
        </n-icon>
      </button>
      <button class="toolbar-btn" :class="{ 'is-active': editor.isActive('highlight') }" title="高亮"
        @click="editor.chain().focus().toggleHighlight().run()">
        <n-icon size="18">
          <HighlightOutlined />
        </n-icon>
      </button>
      <button class="toolbar-btn" :class="{ 'is-active': editor.isActive('subscript') }" title="下标"
        @click="editor.chain().focus().toggleSubscript().run()">
        <n-icon size="16">
          <SubscriptOutlined />
        </n-icon>
      </button>
      <button class="toolbar-btn" :class="{ 'is-active': editor.isActive('superscript') }" title="上标"
        @click="editor.chain().focus().toggleSuperscript().run()">
        <n-icon size="16">
          <SuperscriptOutlined />
        </n-icon>
      </button>
      <button class="toolbar-btn" :class="{ 'is-active': editor.isActive('ruby') }" title="注音" @click="handleRuby">
        <n-icon size="16">
          <TranslateOutlined />
        </n-icon>
      </button>

      <span class="toolbar-divider" />

      <!-- 文字颜色 -->
      <button class="toolbar-btn toolbar-btn--color" :class="{ 'is-active': openDropdown === 'color' }" title="文字颜色"
        @click="toggleDropdown('color')">
        <span class="color-indicator" :style="{ color: currentTextColor || '#e0e0e0' }">A</span>
        <n-icon size="14" class="chevron" :class="{ 'chevron--up': openDropdown === 'color' }">
          <ExpandMoreOutlined />
        </n-icon>
      </button>

      <!-- 链接 URL 输入 popover -->
      <div v-if="inputMode" class="link-popover">
        <n-icon size="16" class="input-icon">
          <LinkOutlined v-if="inputMode === 'link'" />
          <TranslateOutlined v-else />
        </n-icon>
        <input ref="inputRef" v-model="inputValue" class="link-input" type="text"
          :placeholder="inputMode === 'link' ? '粘贴或输入链接' : '注音（如 hàn zì）'" @keydown.enter.prevent="confirmInput"
          @keydown.esc.prevent="closeInput" />
        <button class="link-btn" title="确认" @click="confirmInput">
          <n-icon size="14">
            <CheckOutlined />
          </n-icon>
        </button>
        <button class="link-btn" title="取消" @click="closeInput">
          <n-icon size="14">
            <CloseOutlined />
          </n-icon>
        </button>
      </div>

      <!-- 下拉面板 -->
      <Teleport to="body">
        <div v-if="openDropdown" class="dropdown-overlay" @click="openDropdown = null" />
        <div v-if="openDropdown === 'block'" class="dropdown-panel" :style="blockPanelStyle">
          <button v-for="item in blockItems" :key="item.key" class="dropdown-item"
            :class="{ 'is-active': isBlockItemActive(item), 'is-disabled': item.disabled }"
            @click="handleBlockItem(item)">
            <span class="dropdown-item-icon">
              <n-icon v-if="item.icon" :size="item.iconSize || 18">
                <component :is="item.icon" />
              </n-icon>
              <span v-else-if="item.textIcon" :class="item.textIconClass">{{ item.textIcon }}</span>
            </span>
            <span class="dropdown-item-label">{{ item.label }}</span>
            <span v-if="!isBlockItemActive(item) && item.shortcut" class="dropdown-item-shortcut">
              {{ item.shortcut }}
            </span>
            <n-icon v-if="isBlockItemActive(item)" size="14" class="dropdown-item-check">
              <CheckOutlined />
            </n-icon>
          </button>
        </div>

        <div v-if="openDropdown === 'admonitionType'" class="dropdown-panel" :style="admonitionTypePanelStyle">
          <button v-for="item in admonitionTypeItems" :key="item.key" class="dropdown-item"
            :class="{ 'is-active': isAdmonitionTypeActive(item) }" @click="handleAdmonitionType(item)">
            <span class="dropdown-item-icon">
              <n-icon :size="18">
                <component :is="item.icon" />
              </n-icon>
            </span>
            <span class="dropdown-item-label">{{ item.label }}</span>
            <n-icon v-if="isAdmonitionTypeActive(item)" size="14" class="dropdown-item-check">
              <CheckOutlined />
            </n-icon>
          </button>
        </div>

        <div v-if="openDropdown === 'align'" class="dropdown-panel" :style="alignPanelStyle">
          <button v-for="item in alignItems" :key="item.key" class="dropdown-item"
            :class="{ 'is-active': isAlignItemActive(item), 'is-divider': item.divider, 'is-disabled': item.disabled }"
            :disabled="item.disabled" @click="handleAlignItem(item)">
            <span v-if="!item.divider" class="dropdown-item-icon">
              <n-icon :size="18">
                <component :is="item.icon" />
              </n-icon>
            </span>
            <span v-if="!item.divider" class="dropdown-item-label">{{ item.label }}</span>
            <span v-if="!item.divider && !isAlignItemActive(item) && item.shortcut" class="dropdown-item-shortcut">{{
              item.shortcut }}</span>
            <n-icon v-if="isAlignItemActive(item) && !item.divider" size="14" class="dropdown-item-check">
              <CheckOutlined />
            </n-icon>
          </button>
        </div>

        <div v-if="openDropdown === 'color'" class="dropdown-panel dropdown-panel--wide" :style="colorPanelStyle">
          <div class="color-section">
            <div class="color-section-title">字体颜色</div>
            <div class="color-swatches">
              <button v-for="c in textColorOptions" :key="`tc-${c.value ?? 'default'}`" class="color-swatch"
                :class="{ 'is-active': currentTextColor === c.value, 'is-default': c.value === null }" :title="c.label"
                @click="applyTextColor(c.value)">
                <span class="swatch-a" :style="{ color: c.value || '#e0e0e0' }">A</span>
              </button>
            </div>
          </div>
          <div class="color-section">
            <div class="color-section-title">背景颜色</div>
            <div class="color-swatches">
              <button v-for="c in bgColorOptions" :key="`bc-${c.value ?? 'none'}`" class="color-swatch color-swatch--bg"
                :class="{ 'is-active': currentBgColor === c.value, 'is-clear': c.value === null }"
                :style="c.value ? { background: c.value } : {}" :title="c.label" @click="applyBgColor(c.value)">
                <span v-if="c.value === null" class="swatch-clear">/</span>
              </button>
            </div>
          </div>
          <div class="color-reset-row">
            <button class="color-reset-btn" @click="resetColors">恢复默认</button>
          </div>
        </div>
      </Teleport>
    </div>
  </BubbleMenu>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { Component } from "vue";
import { BubbleMenu } from "@tiptap/vue-3/menus";
import { NIcon } from "naive-ui";
import {
  TextFieldsOutlined,
  FormatAlignJustifyOutlined,
  ExpandMoreOutlined,
  LinkOutlined,
  CodeOutlined,
  HighlightOutlined,
  SubscriptOutlined,
  SuperscriptOutlined,
  TranslateOutlined,
  FormatListNumberedOutlined,
  FormatListBulletedOutlined,
  ChecklistOutlined,
  FormatAlignLeftOutlined,
  FormatAlignCenterOutlined,
  FormatAlignRightOutlined,
  FormatIndentIncreaseOutlined,
  FormatIndentDecreaseOutlined,
  StickyNote2Outlined,
  LightbulbOutlined,
  InfoOutlined,
  WarningAmberOutlined,
  ErrorOutlined,
  CheckOutlined,
  CloseOutlined,
} from "@vicons/material";
import type { Editor } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { CellSelection } from "@tiptap/pm/tables";
import { isDraggingBlock } from "@/renderer/components/editor/features/drag-reorder/drag-reorder";

const props = defineProps<{
  editor: Editor | null;
}>();

// 独立 PluginKey：与图片浮层（imageBubbleMenu）的插件状态隔离，
// 避免 BubbleMenu 插件实例间相互覆盖 shouldShow 状态
const textBubblePluginKey = new PluginKey("textBubbleMenu");

const toolbarRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);

type DropdownKey = "block" | "admonitionType" | "align" | "color" | null;
const openDropdown = ref<DropdownKey>(null);
const panelStyles = ref({
  block: { top: "0px", left: "0px" },
  admonitionType: { top: "0px", left: "0px" },
  align: { top: "0px", left: "0px" },
  color: { top: "0px", left: "0px" },
});

const blockPanelStyle = computed(() => panelStyles.value.block);
const admonitionTypePanelStyle = computed(() => panelStyles.value.admonitionType);
const alignPanelStyle = computed(() => panelStyles.value.align);
const colorPanelStyle = computed(() => panelStyles.value.color);

const inputMode = ref<"link" | "ruby" | null>(null);
const inputValue = ref("");

const isBlockActive = computed(() => {
  const ed = props.editor;
  return !!ed && (ed.isActive("heading") || ed.isActive("bulletList") || ed.isActive("orderedList") ||
    ed.isActive("taskList") || ed.isActive("blockquote") || ed.isActive("codeBlock") || ed.isActive("admonition"));
});
const isAlignActive = computed(() => {
  const ed = props.editor;
  return !!ed && (ed.isActive({ textAlign: "center" }) || ed.isActive({ textAlign: "right" }));
});
const currentTextColor = computed(() => props.editor?.getAttributes("textStyle").color as string | null ?? null);
const currentBgColor = computed(() => props.editor?.getAttributes("highlight").color as string | null ?? null);

type BlockItem = {
  key: string;
  label: string;
  icon?: Component;
  iconSize?: number;
  textIcon?: string;
  textIconClass?: string;
  shortcut?: string;
  disabled?: boolean;
};

type AlignItem = {
  key: string;
  label: string;
  icon?: Component;
  divider?: boolean;
  shortcut?: string;
  disabled?: boolean;
};

const blockItems: BlockItem[] = [
  { key: "p", label: "正文", textIcon: "T", textIconClass: "icon-t" },
  { key: "h1", label: "一级标题", textIcon: "H1", textIconClass: "icon-h1", shortcut: "Ctrl+Alt+1" },
  { key: "h2", label: "二级标题", textIcon: "H2", textIconClass: "icon-h2", shortcut: "Ctrl+Alt+2" },
  { key: "h3", label: "三级标题", textIcon: "H3", textIconClass: "icon-h3", shortcut: "Ctrl+Alt+3" },
  { key: "ol", label: "有序列表", icon: FormatListNumberedOutlined, iconSize: 18, shortcut: "Ctrl+Shift+7" },
  { key: "ul", label: "无序列表", icon: FormatListBulletedOutlined, shortcut: "Ctrl+Shift+8" },
  { key: "task", label: "任务", icon: ChecklistOutlined },
  { key: "code", label: "代码块", textIcon: "{}", textIconClass: "icon-code", shortcut: "Ctrl+Alt+C" },
  { key: "quote", label: "引用", textIcon: "\u201C", textIconClass: "icon-quote", shortcut: "Ctrl+Shift+B" },
  { key: "admonition", label: "提示块", icon: StickyNote2Outlined, iconSize: 18 },
];

/** 提示块类型（与 admonition-extension 的白名单一致） */
type AdmonitionTypeItem = {
  key: "note" | "tip" | "info" | "warning" | "danger";
  label: string;
  icon: Component;
};

const admonitionTypeItems: AdmonitionTypeItem[] = [
  { key: "note", label: "笔记", icon: StickyNote2Outlined },
  { key: "tip", label: "提示", icon: LightbulbOutlined },
  { key: "info", label: "信息", icon: InfoOutlined },
  { key: "warning", label: "警告", icon: WarningAmberOutlined },
  { key: "danger", label: "危险", icon: ErrorOutlined },
];

/** 当前提示块类型对应的图标（工具栏按钮） */
const currentAdmonitionIcon = computed<Component>(() => {
  const type = (props.editor?.getAttributes("admonition").type as string | undefined) ?? "note";
  return admonitionTypeItems.find((item) => item.key === type)?.icon ?? admonitionTypeItems[0].icon;
});

const alignItems: AlignItem[] = [
  { key: "left", label: "左对齐", icon: FormatAlignLeftOutlined },
  { key: "center", label: "居中对齐", icon: FormatAlignCenterOutlined },
  { key: "right", label: "右对齐", icon: FormatAlignRightOutlined },
  { key: "div1", label: "", divider: true },
  { key: "indent", label: "增加缩进", icon: FormatIndentIncreaseOutlined, shortcut: "Tab" },
  { key: "outdent", label: "减少缩进", icon: FormatIndentDecreaseOutlined, shortcut: "Shift+Tab" },
];

const textColorOptions = [
  { value: null, label: "默认" },
  { value: "#9e9e9e", label: "灰色" },
  { value: "#e0544f", label: "红色" },
  { value: "#e6912e", label: "橙色" },
  { value: "#d4c23a", label: "黄色" },
  { value: "#4caf50", label: "绿色" },
  { value: "#3e8ed0", label: "蓝色" },
  { value: "#b061d8", label: "紫色" },
];

const bgColorOptions = [
  { value: null, label: "无" },
  { value: "#3a3a3a", label: "深灰" },
  { value: "#5c3a3a", label: "深红" },
  { value: "#5c4a2a", label: "棕" },
  { value: "#4a5230", label: "橄榄" },
  { value: "#2d4a3a", label: "深绿" },
  { value: "#2a3f5c", label: "深蓝" },
  { value: "#443060", label: "深紫" },
  { value: "#5a5a5a", label: "灰" },
  { value: "#8a4040", label: "红" },
  { value: "#8a6a30", label: "橙棕" },
  { value: "#6a7a3a", label: "草绿" },
  { value: "#3a6a5a", label: "青绿" },
  { value: "#3a5a8a", label: "蓝" },
  { value: "#6040a0", label: "紫" },
];

function shouldShow(p: {
  editor: Editor;
  view: EditorView;
  state: EditorState;
  oldState?: EditorState;
  from: number;
  to: number;
}): boolean {
  const { editor: ed, from, to } = p;
  if (from === to) return false;
  // 拖拽抑制期（dragstart → 用户重新交互/空选区前）不显示：dragstart 会派发非空
  // 节点选区事务，drop 后官方扩展还会恢复非空选区、且 BubbleMenu 的 update 有
  // 250ms 防抖——不拦截的话工具栏会在拖拽全程及落定约 250ms 后跟随弹出
  if (isDraggingBlock()) return false;
  // 选中图片或代码块时，显示各自的专用浮层，不显示文字工具栏
  if (ed.isActive("image") || ed.isActive("codeBlock")) return false;
  // 表格单元格拖选（CellSelection）时不显示文字工具栏：表格操作由边缘控件承担，
  // 拖选过程中工具栏跟随选区闪烁反而干扰
  if (p.state.selection instanceof CellSelection) return false;
  return true;
}

function updatePanelPositions() {
  if (!toolbarRef.value) return;
  const rect = toolbarRef.value.getBoundingClientRect();
  panelStyles.value.block = {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
  };
  // 提示块类型面板：跟随其工具栏按钮（块类型按钮 ~56px 之后）
  panelStyles.value.admonitionType = {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left + 56}px`,
  };
  // align panel position: approximate position after block button (~56px)
  panelStyles.value.align = {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left + 56}px`,
  };
  // color panel: position near right side
  panelStyles.value.color = {
    top: `${rect.bottom + 4}px`,
    left: `${Math.max(rect.left, rect.right - 248)}px`,
  };
}

function toggleDropdown(key: Exclude<DropdownKey, null>) {
  if (openDropdown.value === key) {
    openDropdown.value = null;
    return;
  }
  closeInput();
  openDropdown.value = key;
  nextTick(updatePanelPositions);
}

function isBlockItemActive(item: typeof blockItems[number]): boolean {
  const ed = props.editor;
  if (!ed) return false;
  switch (item.key) {
    case "p":
      return !ed.isActive("heading") && !ed.isActive("bulletList") && !ed.isActive("orderedList") &&
        !ed.isActive("taskList") && !ed.isActive("blockquote") && !ed.isActive("codeBlock") && !ed.isActive("admonition");
    case "h1": return ed.isActive("heading", { level: 1 });
    case "h2": return ed.isActive("heading", { level: 2 });
    case "h3": return ed.isActive("heading", { level: 3 });
    case "ol": return ed.isActive("orderedList");
    case "ul": return ed.isActive("bulletList");
    case "task": return ed.isActive("taskList");
    case "code": return ed.isActive("codeBlock");
    case "quote": return ed.isActive("blockquote");
    case "admonition": return ed.isActive("admonition");
    default: return false;
  }
}

/** 提示块类型项是否为当前激活类型 */
function isAdmonitionTypeActive(item: AdmonitionTypeItem): boolean {
  const ed = props.editor;
  if (!ed) return false;
  return ed.getAttributes("admonition").type === item.key;
}

/** 切换提示块类型（更新 admonition 节点的 type 属性） */
function handleAdmonitionType(item: AdmonitionTypeItem) {
  const ed = props.editor;
  if (!ed) return;
  ed.chain().focus().updateAttributes("admonition", { type: item.key }).run();
  openDropdown.value = null;
}

function isAlignItemActive(item: typeof alignItems[number]): boolean {
  const ed = props.editor;
  if (!ed || item.divider) return false;
  switch (item.key) {
    case "left": return !ed.isActive({ textAlign: "center" }) && !ed.isActive({ textAlign: "right" });
    case "center": return ed.isActive({ textAlign: "center" });
    case "right": return ed.isActive({ textAlign: "right" });
    default: return false;
  }
}

function handleBlockItem(item: typeof blockItems[number]) {
  const ed = props.editor;
  if (!ed) return;
  const chain = ed.chain().focus();
  switch (item.key) {
    case "p": chain.setNode("paragraph"); break;
    case "h1": chain.toggleHeading({ level: 1 }); break;
    case "h2": chain.toggleHeading({ level: 2 }); break;
    case "h3": chain.toggleHeading({ level: 3 }); break;
    case "ol": chain.toggleOrderedList(); break;
    case "ul": chain.toggleBulletList(); break;
    case "task": chain.toggleTaskList(); break;
    case "code": chain.toggleCodeBlock(); break;
    case "quote": chain.toggleBlockquote(); break;
    case "admonition": chain.toggleWrap("admonition", { type: "note" }); break;
  }
  chain.run();
  openDropdown.value = null;
}

function handleAlignItem(item: typeof alignItems[number]) {
  const ed = props.editor;
  if (!ed || item.divider || item.disabled) return;
  const chain = ed.chain().focus();
  switch (item.key) {
    case "left": chain.setTextAlign("left"); break;
    case "center": chain.setTextAlign("center"); break;
    case "right": chain.setTextAlign("right"); break;
    case "indent":
      if (ed.can().sinkListItem("listItem")) chain.sinkListItem("listItem");
      else if (ed.can().sinkListItem("taskItem")) chain.sinkListItem("taskItem");
      break;
    case "outdent":
      if (ed.can().liftListItem("listItem")) chain.liftListItem("listItem");
      else if (ed.can().liftListItem("taskItem")) chain.liftListItem("taskItem");
      break;
  }
  chain.run();
  openDropdown.value = null;
}

function applyTextColor(color: string | null) {
  const ed = props.editor;
  if (!ed) return;
  if (color === null) {
    ed.chain().focus().unsetColor().run();
  } else {
    ed.chain().focus().setColor(color).run();
  }
}

function applyBgColor(color: string | null) {
  const ed = props.editor;
  if (!ed) return;
  if (color === null) {
    ed.chain().focus().unsetHighlight().run();
  } else {
    ed.chain().focus().toggleHighlight({ color }).run();
  }
}

function resetColors() {
  const ed = props.editor;
  if (!ed) return;
  ed.chain().focus().unsetMark("textStyle").unsetHighlight().run();
  openDropdown.value = null;
}

async function openInput(mode: "link" | "ruby") {
  openDropdown.value = null;
  inputMode.value = mode;
  inputValue.value = mode === "link"
    ? (props.editor?.getAttributes("link").href as string | undefined) ?? ""
    : "";
  await nextTick();
  updatePanelPositions();
  inputRef.value?.focus();
}

function closeInput() {
  inputMode.value = null;
  inputValue.value = "";
}

function confirmInput() {
  const ed = props.editor;
  if (!ed) return;
  const value = inputValue.value.trim();
  if (inputMode.value === "link") {
    if (value) ed.chain().focus().extendMarkRange("link").setLink({ href: value }).run();
    else ed.chain().focus().extendMarkRange("link").unsetLink().run();
  } else if (inputMode.value === "ruby") {
    if (value) ed.chain().focus().setRuby(value).run();
  }
  closeInput();
}

function handleLink() {
  if (!props.editor) return;
  if (props.editor.isActive("link")) {
    props.editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  openInput("link");
}

function handleRuby() {
  const ed = props.editor;
  if (!ed) return;
  if (ed.isActive("ruby")) {
    ed.chain().focus().unsetRuby().run();
    return;
  }
  openInput("ruby");
}

// 选区变化时关闭浮层
watch(() => props.editor?.state.selection, () => {
  openDropdown.value = null;
  closeInput();
});

// 滚动时更新面板位置
function onScroll() {
  if (openDropdown.value || inputMode.value) updatePanelPositions();
}

window.addEventListener("scroll", onScroll, true);
onBeforeUnmount(() => window.removeEventListener("scroll", onScroll, true));
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.bubble-menu {
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
  z-index: $z-dropdown;
  width: max-content;
}

.toolbar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1px;
  height: 40px;
  padding: 0 4px;
  background: #2b2b2b;
  border: 1px solid #3c3c3c;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  color: #c8c8c8;
}

.toolbar-divider {
  width: 1px;
  height: 22px;
  background: #444;
  margin: 0 4px;
  flex-shrink: 0;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 30px;
  height: 30px;
  padding: 0 5px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #d0d0d0;
  cursor: pointer;
  transition: background 100ms ease, color 100ms ease;
  flex-shrink: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  &.is-active {
    color: #fff;
    background: rgba(255, 255, 255, 0.15);
  }
}

.toolbar-btn--wide {
  gap: 0;
  padding: 0 4px;
}

.toolbar-btn--color {
  .color-indicator {
    font-size: 16px;
    font-weight: 600;
    line-height: 1;
    padding: 2px 4px;
    border-radius: 3px;
  }
}

.chevron {
  color: #999;
  transition: transform 150ms ease;
  margin-top: 1px;

  &--up {
    transform: rotate(180deg);
  }
}

.char-icon {
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
  font-family: -apple-system, "Segoe UI", Roboto, sans-serif;

  &--strike {
    text-decoration: line-through;
  }

  &--italic {
    font-style: italic;
    font-weight: 600;
  }

  &--underline {
    text-decoration: underline;
    text-underline-offset: 2px;
  }
}

/* Link/Ruby 输入 popover */
.link-popover {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  padding: 4px 6px;
  background: #2b2b2b;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  z-index: 10;

  .input-icon {
    color: #888;
    flex-shrink: 0;
  }
}

.link-input {
  width: 220px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid #444;
  border-radius: 4px;
  background: #1e1e1e;
  color: #e0e0e0;
  font-size: 12px;
  outline: none;

  &::placeholder {
    color: #777;
  }

  &:focus {
    border-color: #5a8ee8;
  }
}

.link-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #aaa;
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }
}

/* 下拉面板遮罩 */
.dropdown-overlay {
  position: fixed;
  inset: 0;
  z-index: $z-modal-backdrop;
}

/* 下拉面板 */
.dropdown-panel {
  position: fixed;
  min-width: 200px;
  padding: 4px;
  background: #2b2b2b;
  border: 1px solid #3c3c3c;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  z-index: $z-modal;
  color: #d0d0d0;
}

.dropdown-panel--wide {
  min-width: 248px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #d0d0d0;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  transition: background 100ms ease;

  &:hover:not(.is-disabled):not(.is-divider) {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  &.is-active {
    color: #5a8ee8;
  }

  &.is-disabled {
    opacity: 0.4;
    cursor: default;
  }

  &.is-divider {
    height: 1px;
    min-height: 1px;
    padding: 0;
    margin: 4px 6px;
    background: #444;
    pointer-events: none;
    border-radius: 0;
  }
}

.dropdown-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  flex-shrink: 0;
  color: #b0b0b0;
}

.dropdown-item-label {
  flex: 1;
  white-space: nowrap;
}

.dropdown-item-shortcut {
  margin-left: auto;
  padding-left: 16px;
  color: #888;
  font-size: 11px;
  font-family: -apple-system, "Segoe UI", sans-serif;
  white-space: nowrap;
  flex-shrink: 0;
  user-select: none;
}

.dropdown-item-arrow {
  color: #777;
  margin-left: auto;
}

.dropdown-item-check {
  color: #5a8ee8;
  margin-left: auto;
  flex-shrink: 0;
}

/* 图标文字样式 */
.icon-t {
  font-size: 16px;
  font-weight: 600;
  font-family: -apple-system, "Segoe UI", sans-serif;
}

.icon-h1,
.icon-h2,
.icon-h3 {
  font-size: 13px;
  font-weight: 700;
  font-family: -apple-system, "Segoe UI", sans-serif;
  color: #b0b0b0;
}

.icon-code {
  font-size: 13px;
  font-weight: 600;
  font-family: "Consolas", "Fira Code", monospace;
  letter-spacing: -0.5px;
}

.icon-quote {
  font-size: 20px;
  font-family: Georgia, serif;
  color: #b0b0b0;
  line-height: 1;
}

/* 颜色面板 */
.color-section {
  padding: 8px 8px 4px;

  &+& {
    padding-top: 4px;
  }
}

.color-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #e0e0e0;
  margin-bottom: 8px;
}

.color-swatches {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.color-swatch {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  transition: border-color 120ms ease, transform 120ms ease;

  &:hover {
    transform: scale(1.1);
  }

  &.is-active {
    border-color: #5a8ee8;
  }
}

.swatch-a {
  font-size: 17px;
  font-weight: 700;
  line-height: 1;
}

.color-swatch--bg {
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);

  &.is-active {
    border-color: #5a8ee8;
    border-width: 2px;
  }
}

.swatch-clear {
  font-size: 18px;
  color: #999;
  position: relative;
  line-height: 1;

  &::after {
    content: "";
    position: absolute;
    inset: -2px;
    border-top: 1.5px solid #888;
    transform: rotate(-45deg);
  }
}

.color-reset-row {
  padding: 4px 8px 8px;
  border-top: 1px solid #444;
  margin-top: 4px;
}

.color-reset-btn {
  width: 100%;
  height: 32px;
  border: 1px solid #555;
  border-radius: 4px;
  background: transparent;
  color: #d0d0d0;
  cursor: pointer;
  font-size: 13px;
  transition: background 100ms ease;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }
}
</style>
