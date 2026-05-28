<template>
  <n-flex ref="wrapperRef" class="tiptap-editor-wrapper" :class="{ 'slash-active': showSlashMenu }"
    :style="wrapperStyle" @click="focus">
    <EditorContent :editor="editor" class="tiptap-editor markdown-content" />
    <SlashMenu v-if="slashCommand" :visible="showSlashMenu" :editor="editor!" :start-pos="slashStartPos"
      :query="slashQuery" @close="closeSlashMenu" />
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import { createEditorExtensions } from "./extensions";
import type { Extensions, EditorOptions } from "@tiptap/core";
import TurndownService from "turndown";
import { marked } from "marked";
import SlashMenu from "./slash/SlashMenu.vue";

/** Turndown 实例：HTML → Markdown */
const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
});

/** Markdown → HTML（异步，marked 返回 Promise<string>） */
async function mdToHtml(md: string): Promise<string> {
  if (!md) return "";
  const result = await marked.parse(md, { async: true });
  return result;
}

/** HTML → Markdown（同步） */
function htmlToMd(html: string): string {
  if (!html) return "";
  return turndownService.turndown(html);
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
  }>(),
  {
    modelValue: "",
    placeholder: "开始输入...",
    extensions: undefined,
    editorProps: undefined,
    minHeight: 100,
    maxHeight: 200,
    autofocus: false,
    slashCommand: true,
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

const wrapperStyle = computed(() => ({
  minHeight: `${props.minHeight}px`,
  maxHeight: `${props.maxHeight}px`,
}));

/** 斜杠命令菜单状态 */
const showSlashMenu = ref(false);
const slashStartPos = ref(0);
const slashQuery = ref("");

function closeSlashMenu() {
  showSlashMenu.value = false;
  slashQuery.value = "";
  editor.value?.commands.focus();
}

// 使用公用扩展工厂 createEditorExtensions（已在工厂内自动去重）
const finalExtensions = (props.extensions && props.extensions.length > 0)
  ? createEditorExtensions(props.placeholder, props.extensions)
  : createEditorExtensions(props.placeholder);

const editor = useEditor({
  content: "", // 初始为空，由 watch/onMounted 通过 Markdown 异步设置
  extensions: finalExtensions,
  editorProps: {
    ...props.editorProps,
    attributes: {
      class: "tiptap-editor",
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
        const { state } = view;
        const { $from } = state.selection;
        const textBefore = $from.pos > 0
          ? state.doc.textBetween(Math.max(0, $from.pos - 1), $from.pos)
          : "";
        if ($from.parentOffset === 0 || textBefore === " " || textBefore === "\n") {
          // 让 / 先插入，然后下一个微任务中打开菜单
          nextTick(() => {
            const curState = view.state;
            const curSel = curState.selection;
            slashStartPos.value = curSel.$from.pos;
            slashQuery.value = "";
            showSlashMenu.value = true;
          });
          return false;
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
    emit("update:modelValue", htmlToMd(ed.getHTML()));
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
  editor.value?.commands.clearContent(true);
  updateHeight();
};

/** 获取焦点 */
const focus = () => {
  editor.value?.commands.focus();
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
  return htmlToMd(editor.value?.getHTML() ?? "");
};

/** 监听 modelValue 变化（Markdown → HTML 后设置到编辑器） */
watch(
  () => props.modelValue,
  async (newVal) => {
    const currentMd = htmlToMd(editor.value?.getHTML() ?? "");
    if (newVal !== currentMd) {
      const html = await mdToHtml(newVal ?? "");
      editor.value?.commands.setContent(html, { emitUpdate: true });
    }
  },
);

/** 初始化时从 Markdown 转换内容 */
onMounted(async () => {
  if (props.modelValue) {
    const html = await mdToHtml(props.modelValue);
    editor.value?.commands.setContent(html, { emitUpdate: false });
  }
});

onBeforeUnmount(() => {
  editor.value?.destroy();
});

defineExpose({ focus, clear, getHTML, getMarkdown, getText, editor });
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
  font-family: inherit;
  font-size: $font-sm;
  line-height: 1.6;
  color: var(--text-primary);
  outline: none;
  padding: 0;

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
