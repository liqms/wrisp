<template>
  <n-flex ref="wrapperRef" class="tiptap-editor-wrapper" :class="{ 'slash-active': showSlashMenu }"
    :style="wrapperStyle" @click="focus" @contextmenu="onContextMenu">
    <EditorContent :editor="editor" class="tiptap-editor markdown-content" />
    <BubbleMenu v-if="editor && enableBubbleMenu" :editor="editor" :edit-link="openLinkModal" />
    <ImageBubbleMenu v-if="editor && enableBubbleMenu" :editor="editor" />
    <SlashMenu v-if="slashCommand && editor" :visible="showSlashMenu" :editor="editor" :start-pos="slashStartPos"
      :query="slashQuery" @close="closeSlashMenu" />
    <ContextMenu :visible="contextVisible" :pos-x="contextX" :pos-y="contextY" :has-selection="contextHasSelection"
      @update:visible="contextVisible = $event" @cut="handleCut" @copy="handleCopy" @paste="handlePaste"
      @select-all="handleSelectAll" />
    <TableEdgeControls :editor="editor ?? null" />
    <LinkEditModal :visible="linkModalVisible" :href="linkModalHref" :anchor-el="linkAnchorEl"
      @update:visible="linkModalVisible = $event" @save="saveLink" @remove="removeLink" @open="openLinkExternal" />
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import { createEditorExtensions } from "./extensions";
import type { Extensions, EditorOptions } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { pickDate } from "./slash/commands/datePicker";
import { marked } from "marked";
import type { PageCatalogItem } from "@/shared/types/page.types";
import SlashMenu from "./slash/SlashMenu.vue";
import BubbleMenu from "./menus/BubbleMenu.vue";
import ImageBubbleMenu from "./features/image/ImageBubbleMenu.vue";
import TableEdgeControls from "./features/table/TableEdgeControls.vue";
import ContextMenu from "./menus/ContextMenu.vue";
import LinkEditModal from "./menus/LinkEditModal.vue";
import { useFrontendNotification } from "@/renderer/composables/useNotification.ts";

/** Markdown → HTML（异步，marked 返回 Promise<string>） */
async function mdToHtml(md: string): Promise<string> {
  if (!md) return "";
  const result = await marked.parse(md, { async: true });
  return result;
}

type EditorProps = Partial<EditorOptions["editorProps"]>;

const props = withDefaults(
  defineProps<{
    /** 编辑器初始内容 (Markdown) */
    modelValue?: string;
    /** 占位符文本 */
    placeholder?: string;
    /** 自定义扩展列表，默认使用轻量 StarterKit + Placeholder */
    extensions?: Extensions;
    /** 传递给编辑器的 editorProps */
    editorProps?: EditorProps;
    /** 最小高度 (px) */
    minHeight?: number;
    /** 最大高度 (px) */
    maxHeight?: number;
    /** 是否自动获取焦点 */
    autofocus?: boolean;
    /** 是否启用斜杠命令菜单 */
    slashCommand?: boolean;
    /** 是否启用气泡菜单 */
    enableBubbleMenu?: boolean;
  }>(),
  {
    modelValue: "",
    placeholder: "",
    extensions: undefined,
    editorProps: undefined,
    minHeight: 100,
    maxHeight: 200,
    autofocus: false,
    slashCommand: true,
    enableBubbleMenu: true,
  },
);

const emit = defineEmits<{
  /** 内容更新 (Markdown) */
  "update:modelValue": [value: string];
  /** 获得焦点 */
  focus: [];
  /** 失去焦点 */
  blur: [];
  /** 按下 Enter (提交) */
  enter: [];
}>();

const wrapperRef = ref<HTMLDivElement | null>(null);

// 用于模板 ref 绑定，作为菜单定位的参考容器
void wrapperRef;

/** 链接编辑 popover 状态 */
const linkModalVisible = ref(false);
const linkModalHref = ref("");
const linkAnchorEl = ref<HTMLElement | null>(null);
const notify = useFrontendNotification({ title: "", content: "" });

const wrapperStyle = computed(() => ({
  minHeight: `${props.minHeight}px`,
  maxHeight: `${props.maxHeight}px`,
}));

/** 斜杠命令菜单状态 */
const showSlashMenu = ref(false);
const slashStartPos = ref(0);
const slashQuery = ref("");

/** 右键上下文菜单状态 */
const contextVisible = ref(false);
const contextX = ref(0);
const contextY = ref(0);
/** 右键时编辑器是否已有选中文本，用于区分上下文菜单可选项 */
const contextHasSelection = ref(false);

function onContextMenu(e: MouseEvent): void {
  e.preventDefault();
  contextX.value = e.clientX;
  contextY.value = e.clientY;
  contextHasSelection.value = editor.value ? !editor.value.state.selection.empty : false;
  contextVisible.value = true;
}

function focusEditor(): void {
  editor.value?.commands?.focus?.();
}

function handleCut(): void {
  focusEditor();
  document.execCommand("cut");
}

function handleCopy(): void {
  focusEditor();
  document.execCommand("copy");
}

function handlePaste(): void {
  focusEditor();
  document.execCommand("paste");
}

function handleSelectAll(): void {
  focusEditor();
  editor.value?.commands?.selectAll?.();
}

function closeSlashMenu() {
  showSlashMenu.value = false;
  slashQuery.value = "";
  editor.value?.commands?.focus();
}

/** 保存链接编辑结果（空值表示移除链接） */
function saveLink(href: string) {
  const ed = editor.value;
  if (!ed) return;
  if (href) {
    ed.chain().focus().extendMarkRange("link").setLink({ href }).run();
  } else {
    ed.chain().focus().extendMarkRange("link").unsetLink().run();
  }
  linkModalVisible.value = false;
}

/** 移除当前链接 */
function removeLink() {
  editor.value?.chain().focus().extendMarkRange("link").unsetLink().run();
  linkModalVisible.value = false;
}

/** 日期文本命中信息 */
interface DateRangeHit {
  from: number;
  to: number;
  date: string;
}

/** 判断 pos 是否落在 `[[YYYY-MM-DD]]` 日期文本内；命中则返回其范围与日期 */
function findDateRange(view: EditorView, pos: number): DateRangeHit | null {
  const re = /\[\[(\d{4}-\d{2}-\d{2})\]\]/g;
  let hit: DateRangeHit | null = null;
  view.state.doc.descendants((node, nodePos) => {
    if (hit) return false;
    if (!node.isText) return true;
    const text = node.text ?? "";
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const from = nodePos + m.index;
      const to = from + m[0].length;
      if (pos >= from && pos <= to) {
        hit = { from, to, date: m[1] };
        return false;
      }
    }
    return true;
  });
  return hit;
}

/** 打开链接编辑 popover（供点击链接与 menu 组件共用） */
function openLinkModal(href: string, anchorEl?: HTMLElement | null) {
  linkModalHref.value = href;
  linkAnchorEl.value = anchorEl ?? null;
  linkModalVisible.value = true;
}

/** 在系统浏览器中打开当前编辑的链接 */
function openLinkExternal() {
  const href = linkModalHref.value;
  if (!href) return;
  void window.electronAPI.system.openExternal(href).then((res) => {
    if (!res.success) {
      notify.error("", t("SYSTEM.OPEN_EXTERNAL_ERROR"));
    }
  });
}

// 使用公用扩展工厂 createEditorExtensions（已在工厂内自动去重）
// 未显式传入 placeholder 时使用 i18n 文案，避免硬编码中文
const { t } = useI18n();
const resolvedPlaceholder = props.placeholder || t("EDITOR.PLACEHOLDER");
const finalExtensions = (props.extensions && props.extensions.length > 0)
  ? createEditorExtensions(resolvedPlaceholder, props.extensions)
  : createEditorExtensions(resolvedPlaceholder);

const editor = useEditor({
  content: "", // 初始为空，由 watch 通过 Markdown 异步设置
  extensions: finalExtensions,
  editorProps: {
    ...props.editorProps,
    attributes: {
      class: "tiptap-editor",
      // 关闭浏览器拼写检查（红色波浪线消失）
      spellcheck: 'false',
    },
    handleClick: (view, pos, event) => {
      // 先调用外部传入的 handleClick
      if (props.editorProps?.handleClick?.(view, pos, event)) {
        return true;
      }
      // 点击 [[YYYY-MM-DD]] 日期文本：打开日期选择器（初始定位到该日期），选择后替换
      const dateHit = findDateRange(view, pos);
      if (dateHit) {
        event.preventDefault();
        void pickDate(view, dateHit.from, undefined, dateHit.date)
          .then((value) => {
            if (!value || value === dateHit.date) return;
            view.dispatch(view.state.tr.insertText(`[[${value}]]`, dateHit.from, dateHit.to));
          })
          .catch(() => {
            // 选择器打开/解析失败时保持原文本不变
          });
        return true;
      }

      // 仅处理链接点击；其他点击交给编辑器默认行为
      const anchor = (event.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return false;
      const href = anchor.getAttribute("href");
      if (!href) return false;
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        // Ctrl/Cmd + 点击：使用系统浏览器打开
        void window.electronAPI.system.openExternal(href).then((res) => {
          if (!res.success) {
            notify.error("", t("SYSTEM.OPEN_EXTERNAL_ERROR"));
          }
        });
        return true;
      }
      // 普通点击：弹出编辑链接 popover（锚定在被点击的链接下方）
      // handleClick 返回 true 会阻止 ProseMirror 移动光标，这里手动把光标置入链接内，
      // 以便保存时 extendMarkRange("link") 能定位到该链接
      const linkStart = view.posAtDOM(anchor, 0);
      if (linkStart != null) {
        const docSize = view.state.doc.content.size;
        const from = Math.min(linkStart, docSize);
        view.dispatch(
          view.state.tr.setSelection(TextSelection.create(view.state.doc, from, Math.min(from + 1, docSize))),
        );
      }
      openLinkModal(href, anchor);
      return true;
    },
    handleKeyDown: (view, event) => {
      // 先调用外部传入的 handleKeyDown
      if (props.editorProps?.handleKeyDown?.(view, event)) {
        return true;
      }

      // 斜杠菜单打开时的快捷键
      if (showSlashMenu.value) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeSlashMenu();
          return true;
        }
        // 阻止 Enter/ArrowUp/ArrowDown 传给编辑器
        if (["Enter", "ArrowUp", "ArrowDown"].includes(event.key)) {
          event.preventDefault();
          return true;
        }
        return false;
      }

      // 检测斜杠命令：在行首或空格后输入 /
      if (props.slashCommand && event.key === "/" && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
        const { state, dispatch } = view;
        const { $from } = state.selection;
        const textBefore = $from.pos > 0
          ? state.doc.textBetween(Math.max(0, $from.pos - 1), $from.pos)
          : "";
        if ($from.parentOffset === 0 || textBefore === " " || textBefore === "\n") {
          // 主动插入斜杠（保留在编辑器中），并记录斜杠结束位置后打开菜单
          event.preventDefault();
          const insertPos = state.selection.from;
          dispatch(state.tr.insertText("/", insertPos));
          slashStartPos.value = insertPos + 1;
          slashQuery.value = "";
          showSlashMenu.value = true;
          return true;
        }
      }

      // Shift+Enter 提交，Enter 换行
      if (event.key === "Enter" && event.shiftKey) {
        event.preventDefault();
        emit("enter");
        return true;
      }
      return false;
    },
  },
  onUpdate: ({ editor: ed }) => {
    emit("update:modelValue", ed.getMarkdown());
    updateHeight();

    // 斜杠菜单打开时追踪查询文本
    if (props.slashCommand && showSlashMenu.value && slashStartPos.value > 0) {
      const { state } = ed;
      const { $from } = state.selection;
      const query = state.doc.textBetween(slashStartPos.value, $from.pos);
      slashQuery.value = query;
      // 如果输入了空格，关闭菜单
      if (query.includes(" ")) {
        closeSlashMenu();
      }
    }
  },
  onFocus: () => {
    emit("focus");
  },
  onBlur: () => {
    // 延迟关闭，让点击菜单项先触发
    setTimeout(() => {
      if (!showSlashMenu.value) {
        emit("blur");
      }
    }, 150);
  },
  autofocus: props.autofocus,
});

/** 自动调整编辑器高度 */
const updateHeight = () => {
  const el = editor.value?.options.element;
  if (!el || !(el instanceof HTMLElement)) return;
  const pmEl = el.querySelector(".ProseMirror") as HTMLElement | null;
  if (!pmEl) return;
  pmEl.style.minHeight = "auto";
  const scrollHeight = pmEl.scrollHeight;
  pmEl.style.minHeight = `${Math.min(scrollHeight, props.maxHeight)}px`;
};

/** 清空编辑器内容 */
const clear = () => {
  editor.value?.commands?.clearContent(true);
  updateHeight();
};

/** 获取焦点 */
const focus = () => {
  editor.value?.commands?.focus();
};

/** 获取 HTML 内容 */
const getHTML = (): string => {
  return editor.value?.getHTML() ?? "";
};

/** 获取纯文本内容 */
const getText = (): string => {
  return editor.value?.getText() ?? "";
};

/** 获取 Markdown 内容 */
const getMarkdown = (): string => {
  return editor.value?.getMarkdown() ?? "";
};

/**
 * 提取 1-3 级标题目录（编辑器就绪后调用）。
 * 通过 doc.descendants 遍历任意嵌套位置，pos 为标题在文档中的真实偏移，
 * 供上层"点击目录定位到对应位置"使用。
 */
function getCatalog(): PageCatalogItem[] {
  const ed = editor.value;
  if (!ed) return [];
  const items: PageCatalogItem[] = [];
  ed.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading" && node.attrs.level <= 3) {
      items.push({
        level: node.attrs.level as 1 | 2 | 3,
        text: node.textContent,
        pos,
      });
    }
  });
  return items;
}

/** 监听 modelValue 变化（Markdown → HTML 后设置到编辑器，含初始化） */
watch(
  (): string | undefined => props.modelValue,
  async (newVal) => {
    if (newVal == null) return;
    try {
      const currentMd = editor.value?.getMarkdown() ?? "";
      if (newVal === currentMd) return;
      const html = await mdToHtml(newVal);
      // 不直接访问 editor.value，避免 getter/Proxy 竞态，统一通过 watch 等待就绪
      let done = false;
      let stop: (() => void) | undefined;
      stop = watch(editor, (ed) => {
        if (done || ed == null) return;
        try {
          done = true;
          stop?.();
          ed.commands?.setContent?.(html, { emitUpdate: true });
        } catch {
          done = false;
        }
      }, { immediate: true });
    } catch (e) {
      console.error("[TiptapEditor] 更新内容失败:", e);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  editor.value?.destroy();
});

defineExpose({ focus, clear, getHTML, getMarkdown, getText, getCatalog, editor });
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;
@use "@/renderer/styles/_markdown" as *;

.tiptap-editor-wrapper {
  flex: 1;
  overflow-y: auto;
  cursor: text;
  position: relative;
  scrollbar-color: var(--scrollbar-track) transparent;
  scrollbar-width: thin;
}

:deep(.tiptap-editor) {
  outline: none;
}

:deep(.ProseMirror) {
  font-size: $font-sm;
  line-height: 1.5;
  color: var(--text-primary);
  outline: none;
  /* 顶部/左侧预留空间给表格 edge handles（列/行 handle 伸出到容器外） */
  padding: 22px 0 0 24px;

  >*+* {
    margin-top: 0.25em;
  }

  p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    color: var(--text-quaternary);
    font-weight: $font-normal;
    letter-spacing: 0.01em;
    pointer-events: none;
    height: 0;
  }
}
</style>
