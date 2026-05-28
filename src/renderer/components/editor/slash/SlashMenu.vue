<template>
  <div
    v-if="visible"
    ref="menuRef"
    class="slash-menu"
    :style="menuStyle"
    @mousedown.prevent
  >
    <div class="slash-search">
      <n-input
        ref="inputRef"
        v-model:value="searchText"
        placeholder="输入命令..."
        size="small"
        clearable
        @keydown="onKeydown"
      >
        <template #prefix>
          <span class="slash-icon">/</span>
        </template>
      </n-input>
    </div>
    <n-scrollbar class="slash-commands" trigger="none">
      <template v-if="filteredGroups.length > 0">
        <div
          v-for="(group, gi) in filteredGroups"
          :key="gi"
          class="slash-group"
        >
          <div class="slash-group-label">{{ group.label }}</div>
          <div
            v-for="(cmd, ci) in group.items"
            :key="cmd.id"
            class="slash-command"
            :class="{ 'is-selected': selectedIndex === getGlobalIndex(gi, ci) }"
            @click="executeCommand(cmd)"
            @mouseenter="selectedIndex = getGlobalIndex(gi, ci)"
          >
            <div class="cmd-icon" v-html="cmd.icon"></div>
            <div class="cmd-info">
              <div class="cmd-title">{{ cmd.title }}</div>
              <div class="cmd-desc">{{ cmd.description }}</div>
            </div>
          </div>
        </div>
      </template>
      <n-empty
        v-else
        description="没有匹配的命令"
        size="tiny"
        class="slash-empty"
      />
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import { NInput, NScrollbar, NEmpty } from "naive-ui";
import type { Editor } from "@tiptap/core";

interface SlashCommand {
  id: string;
  title: string;
  description: string;
  icon: string;
  action: (editor: Editor, pos: number) => void;
}

interface CommandGroup {
  label: string;
  items: SlashCommand[];
}

const props = defineProps<{
  visible: boolean;
  editor: Editor;
  startPos: number;
  query: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const menuRef = ref<HTMLDivElement | null>(null);
const inputRef = ref<InstanceType<typeof NInput> | null>(null);
const searchText = ref(props.query);
const selectedIndex = ref(0);

const menuStyle = ref<Record<string, string>>({});

watch(
  () => props.visible,
  async (v) => {
    if (v) {
      searchText.value = props.query;
      selectedIndex.value = 0;
      await nextTick();
      positionMenu();
      inputRef.value?.focus();
      // 将光标移到输入框末尾
      const inputEl = menuRef.value?.querySelector('input') as HTMLInputElement | null;
      if (inputEl) {
        inputEl.setSelectionRange(searchText.value.length, searchText.value.length);
      }
    }
  },
);

watch(
  () => props.query,
  (q) => {
    searchText.value = q;
    selectedIndex.value = 0;
  },
);

const commandGroups: CommandGroup[] = [
  {
    label: "文本格式",
    items: [
      {
        id: "bold",
        title: "加粗",
        description: "粗体文本",
        icon: '<strong style="font-size:14px">B</strong>',
        action: (editor, pos) => {
          deleteSlashText(editor, pos);
          editor.chain().focus().toggleBold().run();
        },
      },
      {
        id: "italic",
        title: "斜体",
        description: "斜体文本",
        icon: '<em style="font-size:14px">I</em>',
        action: (editor, pos) => {
          deleteSlashText(editor, pos);
          editor.chain().focus().toggleItalic().run();
        },
      },
      {
        id: "underline",
        title: "下划线",
        description: "下划线文本",
        icon: '<u style="font-size:14px">U</u>',
        action: (editor, pos) => {
          deleteSlashText(editor, pos);
          editor.chain().focus().toggleUnderline().run();
        },
      },
      {
        id: "strike",
        title: "删除线",
        description: "删除线文本",
        icon: '<s style="font-size:14px">S</s>',
        action: (editor, pos) => {
          deleteSlashText(editor, pos);
          editor.chain().focus().toggleStrike().run();
        },
      },
      {
        id: "code",
        title: "行内代码",
        description: "行内代码样式",
        icon: '<span style="font-family:monospace;font-size:13px">&lt;/&gt;</span>',
        action: (editor, pos) => {
          deleteSlashText(editor, pos);
          editor.chain().focus().toggleCode().run();
        },
      },
      {
        id: "highlight",
        title: "高亮",
        description: "标记高亮文本",
        icon: '<span style="background:#ffe066;padding:0 2px;border-radius:2px;font-size:12px">A</span>',
        action: (editor, pos) => {
          deleteSlashText(editor, pos);
          editor.chain().focus().toggleHighlight().run();
        },
      },
    ],
  },
  {
    label: "标题",
    items: [
      {
        id: "h1",
        title: "标题 1",
        description: "大标题",
        icon: '<strong style="font-size:16px">H1</strong>',
        action: (editor, pos) => {
          deleteSlashText(editor, pos);
          editor.chain().focus().toggleHeading({ level: 1 }).run();
        },
      },
      {
        id: "h2",
        title: "标题 2",
        description: "中标题",
        icon: '<strong style="font-size:15px">H2</strong>',
        action: (editor, pos) => {
          deleteSlashText(editor, pos);
          editor.chain().focus().toggleHeading({ level: 2 }).run();
        },
      },
      {
        id: "h3",
        title: "标题 3",
        description: "小标题",
        icon: '<strong style="font-size:14px">H3</strong>',
        action: (editor, pos) => {
          deleteSlashText(editor, pos);
          editor.chain().focus().toggleHeading({ level: 3 }).run();
        },
      },
    ],
  },
  {
    label: "块级元素",
    items: [
      {
        id: "blockquote",
        title: "引文",
        description: "引用文本块",
        icon: '<span style="font-size:16px">"</span>',
        action: (editor, pos) => {
          deleteSlashText(editor, pos);
          editor.chain().focus().toggleBlockquote().run();
        },
      },
      {
        id: "codeBlock",
        title: "代码块",
        description: "代码块（带语法高亮）",
        icon: '<span style="font-family:monospace;font-size:14px">{ }</span>',
        action: (editor, pos) => {
          deleteSlashText(editor, pos);
          editor.chain().focus().toggleCodeBlock().run();
        },
      },
      {
        id: "bulletList",
        title: "无序列表",
        description: "项目符号列表",
        icon: '<span style="font-size:16px">•</span>',
        action: (editor, pos) => {
          deleteSlashText(editor, pos);
          editor.chain().focus().toggleBulletList().run();
        },
      },
      {
        id: "orderedList",
        title: "有序列表",
        description: "编号列表",
        icon: '<span style="font-size:14px">1.</span>',
        action: (editor, pos) => {
          deleteSlashText(editor, pos);
          editor.chain().focus().toggleOrderedList().run();
        },
      },
      {
        id: "taskList",
        title: "任务列表",
        description: "带复选框的任务列表",
        icon: '<span style="font-size:14px">☑</span>',
        action: (editor, pos) => {
          deleteSlashText(editor, pos);
          editor.chain().focus().toggleTaskList().run();
        },
      },
      {
        id: "divider",
        title: "分隔线",
        description: "水平分割线",
        icon: '<span style="font-size:16px">—</span>',
        action: (editor, pos) => {
          deleteSlashText(editor, pos);
          editor.chain().focus().setHorizontalRule().run();
        },
      },
    ],
  },
];

/** 删除斜杠及后面的查询文本 */
function deleteSlashText(editor: Editor, pos: number) {
  const { state } = editor;
  const { doc } = state;
  // 从 pos 往后读取直到遇到空格或行尾
  let endPos = pos;
  while (endPos < doc.content.size) {
    const char = doc.textBetween(endPos, endPos + 1);
    if (char === " " || char === "\n") break;
    endPos++;
  }
  // 如果 endPos 没变，说明 pos 处不是斜杠，尝试往前找
  if (endPos === pos) {
    const textBefore = doc.textBetween(Math.max(0, pos - 10), pos);
    const slashIdx = textBefore.lastIndexOf("/");
    if (slashIdx >= 0) {
      const actualStart = Math.max(0, pos - 10) + slashIdx;
      editor
        .chain()
        .focus()
        .deleteRange({ from: actualStart, to: pos })
        .run();
      return;
    }
  }
  editor.chain().focus().deleteRange({ from: pos - 1, to: endPos }).run();
}

function getGlobalIndex(gi: number, ci: number): number {
  let idx = 0;
  for (let i = 0; i < gi; i++) {
    idx += commandGroups[i].items.length;
  }
  return idx + ci;
}

const filteredGroups = computed(() => {
  const q = searchText.value.toLowerCase().trim();
  if (!q) return commandGroups;
  return commandGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (cmd) =>
          cmd.title.toLowerCase().includes(q) ||
          cmd.description.toLowerCase().includes(q) ||
          cmd.id.toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.items.length > 0);
});

const totalItems = computed(() => {
  let count = 0;
  for (const g of filteredGroups.value) {
    count += g.items.length;
  }
  return count;
});

function positionMenu() {
  if (!props.editor) return;
  const { view } = props.editor;
  const coords = view.coordsAtPos(props.startPos);
  const editorEl = view.dom.closest(".tiptap-editor-wrapper") as HTMLElement | null;
  if (!editorEl) return;
  const editorRect = editorEl.getBoundingClientRect();

  menuStyle.value = {
    left: `${Math.max(0, coords.left - editorRect.left)}px`,
    top: `${coords.bottom - editorRect.top + 4}px`,
  };
}

function executeCommand(cmd: SlashCommand) {
  cmd.action(props.editor, props.startPos);
  emit("close");
}

function onKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      selectedIndex.value = Math.min(selectedIndex.value + 1, totalItems.value - 1);
      scrollToSelected();
      break;
    case "ArrowUp":
      e.preventDefault();
      selectedIndex.value = Math.max(selectedIndex.value - 1, 0);
      scrollToSelected();
      break;
    case "Enter":
      e.preventDefault();
      const flatCmds = filteredGroups.value.flatMap((g) => g.items);
      const cmd = flatCmds[selectedIndex.value];
      if (cmd) executeCommand(cmd);
      break;
    case "Escape":
      e.preventDefault();
      emit("close");
      break;
  }
}

function scrollToSelected() {
  nextTick(() => {
    const selected = menuRef.value?.querySelector(".is-selected");
    selected?.scrollIntoView({ block: "nearest" });
  });
}

function handleClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    emit("close");
  }
}

onMounted(() => {
  document.addEventListener("mousedown", handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", handleClickOutside);
});
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.slash-menu {
  position: absolute;
  z-index: $z-dropdown;
  width: 280px;
  max-height: 320px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: $radius-lg;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.slash-search {
  padding: $spacing-xs $spacing-xs 0;
}

.slash-icon {
  font-size: $font-sm;
  font-weight: $font-bold;
  line-height: 1;
}

.slash-commands {
  flex: 1;
  padding: $spacing-xs 0;
}

.slash-group {
  &:not(:last-child) {
    padding-bottom: $spacing-xs;
  }
}

.slash-group-label {
  padding: $spacing-xs $spacing-md;
  font-size: $font-xs;
  color: var(--text-tertiary);
  font-weight: $font-medium;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.slash-command {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: $spacing-sm $spacing-md;
  cursor: pointer;
  transition: background $transition-fast ease;

  &:hover,
  &.is-selected {
    background: var(--bg-hover);
  }

  .cmd-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: $radius-md;
    background: var(--bg-secondary);
    flex-shrink: 0;
    color: var(--text-color);
  }

  .cmd-info {
    flex: 1;
    min-width: 0;
  }

  .cmd-title {
    font-size: $font-sm;
    font-weight: $font-medium;
    color: var(--text-color);
    line-height: 1.4;
  }

  .cmd-desc {
    font-size: $font-xs;
    color: var(--text-tertiary);
    line-height: 1.3;
  }
}

.slash-empty {
  padding: $spacing-xl 0;
}
</style>
