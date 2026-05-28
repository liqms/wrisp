<template>
  <BubbleMenu
    :editor="editor"
    :tippy-options="{ duration: 150 }"
    class="bubble-menu"
  >
    <n-flex class="bubble-menu-inner" align="center">
      <n-button-group size="tiny">
        <n-button
          quaternary
          :type="editor.isActive('bold') ? 'primary' : 'default'"
          @click="editor.chain().focus().toggleBold().run()"
          title="粗体"
          class="bubble-btn"
        >
          <n-icon size="16"><FormatBoldOutlined /></n-icon>
        </n-button>
        <n-button
          quaternary
          :type="editor.isActive('italic') ? 'primary' : 'default'"
          @click="editor.chain().focus().toggleItalic().run()"
          title="斜体"
          class="bubble-btn"
        >
          <n-icon size="16"><FormatItalicOutlined /></n-icon>
        </n-button>
        <n-button
          quaternary
          :type="editor.isActive('underline') ? 'primary' : 'default'"
          @click="editor.chain().focus().toggleUnderline().run()"
          title="下划线"
          class="bubble-btn"
        >
          <n-icon size="16"><FormatUnderlinedOutlined /></n-icon>
        </n-button>
        <n-button
          quaternary
          :type="editor.isActive('strike') ? 'primary' : 'default'"
          @click="editor.chain().focus().toggleStrike().run()"
          title="删除线"
          class="bubble-btn"
        >
          <n-icon size="16"><StrikethroughSOutlined /></n-icon>
        </n-button>
        <n-button
          quaternary
          :type="editor.isActive('highlight') ? 'primary' : 'default'"
          @click="editor.chain().focus().toggleHighlight().run()"
          title="高亮"
          class="bubble-btn"
        >
          <n-icon size="16"><HighlightOutlined /></n-icon>
        </n-button>
      </n-button-group>

      <n-divider vertical class="bubble-divider" />

      <n-button-group size="tiny">
        <n-button
          quaternary
          :type="
            editor.isActive('heading', { level: 2 }) ? 'primary' : 'default'
          "
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
          title="标题2"
          class="bubble-btn"
        >
          <n-text class="heading-text">H2</n-text>
        </n-button>
        <n-button
          quaternary
          :type="
            editor.isActive('heading', { level: 3 }) ? 'primary' : 'default'
          "
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
          title="标题3"
          class="bubble-btn"
        >
          <n-text class="heading-text">H3</n-text>
        </n-button>
      </n-button-group>

      <n-divider vertical class="bubble-divider" />

      <n-button-group size="tiny">
        <n-button
          quaternary
          :type="editor.isActive('code') ? 'primary' : 'default'"
          @click="editor.chain().focus().toggleCode().run()"
          title="行内代码"
          class="bubble-btn"
        >
          <n-icon size="16"><CodeOutlined /></n-icon>
        </n-button>
        <n-button
          quaternary
          :type="editor.isActive('link') ? 'primary' : 'default'"
          @click="handleAddLink"
          title="链接"
          class="bubble-btn"
        >
          <n-icon size="16"><LinkOutlined /></n-icon>
        </n-button>
      </n-button-group>
    </n-flex>
  </BubbleMenu>
</template>

<script setup lang="ts">
import type { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/vue-3/menus";

import {
  FormatBoldOutlined,
  FormatItalicOutlined,
  FormatUnderlinedOutlined,
  StrikethroughSOutlined,
  CodeOutlined,
  HighlightOutlined,
  LinkOutlined,
} from "@vicons/material";

const { editor } = defineProps<{
  editor: Editor;
}>();

function handleAddLink() {
  const previousUrl = editor.getAttributes("link").href || "";
  const url = window.prompt("输入链接 URL:", previousUrl);
  if (url === null) return;
  if (url === "") {
    editor.chain().focus().unsetLink().run();
    return;
  }
  editor.chain().focus().setLink({ href: url }).run();
}
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.bubble-menu {
  display: flex;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: $radius-lg;
  box-shadow: var(--shadow-lg);
  padding: $spacing-xs;
  z-index: $z-popover;
}

.bubble-menu-inner {
  gap: 0;
}

.bubble-btn {
  border-radius: $radius-md !important;
  min-width: 28px;
  height: 28px;
}

.heading-text {
  font-size: 11px;
  font-weight: $font-bold;
  line-height: 1;
}

.bubble-divider {
  height: 16px !important;
  margin: 0 2px;
}
</style>
