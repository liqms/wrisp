<template>
  <BubbleMenu v-if="editor" :editor="editor" :should-show="shouldShow" :options="{ placement: 'top', offset: 8 }"
    class="bubble-menu">
    <div class="bubble-menu-content">
      <!-- 第 1 行：文本格式、代码、高亮、对齐 -->
      <div class="menu-row">
        <button class="menu-btn" :class="{ 'is-active': editor.isActive('bold') }" title="加粗"
          @click="editor.chain().focus().toggleBold().run()">
          <n-icon size="16"><FormatBoldOutlined /></n-icon>
        </button>
        <button class="menu-btn" :class="{ 'is-active': editor.isActive('italic') }" title="斜体"
          @click="editor.chain().focus().toggleItalic().run()">
          <n-icon size="16"><FormatItalicOutlined /></n-icon>
        </button>
        <button class="menu-btn" :class="{ 'is-active': editor.isActive('underline') }" title="下划线"
          @click="editor.chain().focus().toggleUnderline().run()">
          <n-icon size="16"><FormatUnderlinedOutlined /></n-icon>
        </button>
        <button class="menu-btn" :class="{ 'is-active': editor.isActive('strike') }" title="删除线"
          @click="editor.chain().focus().toggleStrike().run()">
          <n-icon size="16"><FormatStrikethroughOutlined /></n-icon>
        </button>

        <span class="menu-divider" />

        <!-- 行内代码 / 高亮 -->
        <button class="menu-btn" :class="{ 'is-active': editor.isActive('code') }" title="行内代码"
          @click="editor.chain().focus().toggleCode().run()">
          <n-icon size="16"><CodeOutlined /></n-icon>
        </button>
        <button class="menu-btn" :class="{ 'is-active': editor.isActive('highlight') }" title="高亮"
          @click="editor.chain().focus().toggleHighlight().run()">
          <n-icon size="16"><HighlightOutlined /></n-icon>
        </button>

        <span class="menu-divider" />

        <!-- 对齐 -->
        <button class="menu-btn" :class="{ 'is-active': editor.isActive({ textAlign: 'left' }) }" title="左对齐"
          @click="editor.chain().focus().setTextAlign('left').run()">
          <n-icon size="16"><FormatAlignLeftOutlined /></n-icon>
        </button>
        <button class="menu-btn" :class="{ 'is-active': editor.isActive({ textAlign: 'center' }) }" title="居中"
          @click="editor.chain().focus().setTextAlign('center').run()">
          <n-icon size="16"><FormatAlignCenterOutlined /></n-icon>
        </button>
        <button class="menu-btn" :class="{ 'is-active': editor.isActive({ textAlign: 'right' }) }" title="右对齐"
          @click="editor.chain().focus().setTextAlign('right').run()">
          <n-icon size="16"><FormatAlignRightOutlined /></n-icon>
        </button>
      </div>

      <!-- 分割线 -->
      <span class="menu-row-divider" />

      <!-- 第 2 行：复制 / 剪切 / 粘贴 -->
      <div class="menu-row">
        <button class="menu-btn" title="剪切" @click="handleCut">
          <n-icon size="16"><ContentCutOutlined /></n-icon>
        </button>
        <button class="menu-btn" title="复制" @click="handleCopy">
          <n-icon size="16"><ContentCopyOutlined /></n-icon>
        </button>
        <button class="menu-btn" title="粘贴" @click="handlePaste">
          <n-icon size="16"><ContentPasteOutlined /></n-icon>
        </button>
      </div>
    </div>
  </BubbleMenu>
</template>

<script setup lang="ts">
import { BubbleMenu } from "@tiptap/vue-3/menus";
import { NIcon } from "naive-ui";
import {
  FormatBoldOutlined,
  FormatItalicOutlined,
  FormatUnderlinedOutlined,
  FormatStrikethroughOutlined,
  CodeOutlined,
  HighlightOutlined,
  FormatAlignLeftOutlined,
  FormatAlignCenterOutlined,
  FormatAlignRightOutlined,
  ContentCutOutlined,
  ContentCopyOutlined,
  ContentPasteOutlined,
} from "@vicons/material";
import type { Editor } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

const props = defineProps<{
  editor: Editor | null;
}>();

function shouldShow(props: {
  editor: Editor;
  view: EditorView;
  state: EditorState;
  oldState?: EditorState;
  from: number;
  to: number;
}): boolean {
  const { editor: ed, from, to } = props;
  // 仅当有选中文本且不是空选区时显示
  if (from === to) return false;
  // 不在代码块中显示
  if (ed.isActive("codeBlock")) return false;
  return true;
}

function handleCopy() {
  const { editor } = props;
  if (!editor) return;
  const { from, to } = editor.state.selection;
  if (from === to) return;
  const text = editor.state.doc.textBetween(from, to, "\n");
  navigator.clipboard.writeText(text);
}

function handleCut() {
  const { editor } = props;
  if (!editor) return;
  const { from, to } = editor.state.selection;
  if (from === to) return;
  const text = editor.state.doc.textBetween(from, to, "\n");
  navigator.clipboard.writeText(text);
  editor.chain().focus().deleteSelection().run();
}

function handlePaste() {
  const { editor } = props;
  if (!editor) return;
  navigator.clipboard.readText().then((text) => {
    if (text) {
      editor.chain().focus().insertContent(text).run();
    }
  });
}
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.bubble-menu {
  padding: 4px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: $radius-lg;
  box-shadow: var(--shadow-lg);
  z-index: $z-dropdown;
  width: max-content;
}

.bubble-menu-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.menu-row {
  display: flex;
  align-items: center;
  gap: 2px;
}

.menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: $font-sm;
  line-height: 1;
  transition: all $transition-fast ease;

  &:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  &.is-active {
    background: var(--bg-tertiary);
    color: var(--primary-color);
  }
}

.menu-divider {
  width: 1px;
  height: 20px;
  background: var(--border-color);
  margin: 0 2px;
  flex-shrink: 0;
}

.menu-row-divider {
  height: 1px;
  width: 100%;
  background: var(--border-color);
  margin: 0;
  flex-shrink: 0;
}
</style>