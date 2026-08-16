<template>
  <Teleport to="body">
    <div v-if="visible" ref="menuRef" class="slash-menu" :style="menuStyle" @mousedown.prevent>
      <div class="slash-search">
        <input ref="inputRef" v-model="searchText" type="text" class="slash-input" placeholder="输入命令..."
          @keydown="onKeydown" />
      </div>
      <div class="slash-commands">
        <template v-if="filteredGroups.length > 0">
          <div v-for="(group, gi) in filteredGroups" :key="gi" class="slash-group">
            <div class="slash-group-label">{{ group.label }}</div>
            <div v-for="(cmd, ci) in group.items" :key="cmd.id" class="slash-command"
              :class="{ 'is-selected': selectedIndex === getGlobalIndex(gi, ci) }" @click="executeCommand(cmd)"
              @mouseenter="selectedIndex = getGlobalIndex(gi, ci)">
              <div class="cmd-icon">
                <component :is="cmd.icon" v-if="isComponentIcon(cmd.icon)" class="cmd-icon-svg" />
                <!-- 字符串图标在命令构建时已通过 sanitizeHtml 清洗，此处渲染是安全的 -->
                <span v-else v-html="cmd.icon"></span>
              </div>
              <div class="cmd-info">
                <div class="cmd-title">{{ cmd.title }}</div>
                <div class="cmd-desc">{{ cmd.description }}</div>
              </div>
            </div>
          </div>
        </template>
        <div v-else class="slash-empty">没有匹配的命令</div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import type { Editor } from "@tiptap/core";
import { useConfig } from "@/renderer/composables/useConfig";
import { getCommandGroups, type CommandGroup } from "./commands/registry";
import type { SlashCommand } from "./commands/types";
import { useTemplateStore } from "@/renderer/store/template.store";
import { PROFESSION } from "@/shared/enums/profession.enums";

const props = defineProps<{
  visible: boolean;
  editor: Editor;
  startPos: number;
  query: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const { profession, locale } = useConfig();
const templateStore = useTemplateStore();

// 打开菜单时确保模板已加载（已加载则跳过）
onMounted(() => {
  if (!templateStore.loaded) templateStore.fetch();
});

const menuRef = ref<HTMLDivElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const searchText = ref(props.query);
const selectedIndex = ref(0);

const menuStyle = ref<Record<string, string>>({});

// 命令组 = 通用(日期时间) + 当前职业或通用职业且已启用的模板
const commandGroups = computed<CommandGroup[]>(() => {
  const items = templateStore
    .allTemplates(locale.value)
    .filter(
      (item) =>
        item.enabled &&
        (item.profession === profession.value ||
          item.profession === PROFESSION.GENERAL ||
          item.profession === PROFESSION.CUSTOM),
    );
  return getCommandGroups(t, items);
});

// 判断图标是否为 Vue 组件（@vicons 等）；字符串则走 v-html
function isComponentIcon(icon: SlashCommand["icon"]): boolean {
  return typeof icon !== "string";
}

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
      if (inputRef.value) {
        inputRef.value.setSelectionRange(searchText.value.length, searchText.value.length);
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

function getGlobalIndex(gi: number, ci: number): number {
  let idx = 0;
  for (let i = 0; i < gi; i++) {
    idx += commandGroups.value[i].items.length;
  }
  return idx + ci;
}

const filteredGroups = computed(() => {
  const q = searchText.value.toLowerCase().trim();
  if (!q) return commandGroups.value;
  return commandGroups.value
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
  const height = menuRef.value?.offsetHeight ?? 0;
  const viewportH = window.innerHeight;
  const left = Math.max(0, coords.left);
  // 下方空间不足时改显示在输入位置上方
  if (coords.bottom + 4 + height > viewportH) {
    menuStyle.value = {
      left: `${left}px`,
      top: `${Math.max(0, coords.top - height - 4)}px`,
    };
  } else {
    menuStyle.value = {
      left: `${left}px`,
      top: `${coords.bottom + 4}px`,
    };
  }
}

function handleScroll() {
  // 页面滚动时跟随输入位置移动
  if (props.visible) positionMenu();
}

function executeCommand(cmd: SlashCommand) {
  cmd.action({ editor: props.editor, pos: props.startPos });
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
    case "Enter": {
      e.preventDefault();
      const flatCmds = filteredGroups.value.flatMap((g) => g.items);
      const cmd = flatCmds[selectedIndex.value];
      if (cmd) executeCommand(cmd);
      break;
    }
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
  // 捕获阶段监听，跟随整体页面/容器滚动移动
  document.addEventListener("scroll", handleScroll, true);
  window.addEventListener("scroll", handleScroll);
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", handleClickOutside);
  document.removeEventListener("scroll", handleScroll, true);
  window.removeEventListener("scroll", handleScroll);
});
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.slash-menu {
  position: fixed;
  z-index: 9999;
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

.slash-input {
  width: 100%;
  height: 32px;
  padding: 0 $spacing-sm;
  font-size: $font-sm;
  color: var(--text-color);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: $radius-md;
  outline: none;
  transition: border-color $transition-fast ease, box-shadow $transition-fast ease;

  &::placeholder {
    color: var(--text-third);
  }

  &:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 20%, transparent);
  }
}

.slash-commands {
  max-height: 260px;
  overflow-y: auto;
  padding: $spacing-xs 0;
  overscroll-behavior: contain;
}

.slash-group {
  &:not(:last-child) {
    padding-bottom: $spacing-xs;
  }
}

.slash-group-label {
  padding: $spacing-xs $spacing-md;
  font-size: $font-xs;
  color: var(--text-third);
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

  .cmd-icon-svg {
    width: 18px;
    height: 18px;
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
    color: var(--text-third);
    line-height: 1.3;
  }
}

.slash-empty {
  padding: $spacing-xl 0;
  text-align: center;
  font-size: $font-xs;
  color: var(--text-third);
}
</style>
