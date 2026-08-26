<template>
  <n-dropdown class="context-menu" :show="visible" :options="menuOptions" :x="posX" :y="posY" @-select="handleSelect"
    @-clickoutside="handleClose" />
</template>

<script setup lang="ts">
import { computed, h } from "vue";
import { NDropdown } from "naive-ui";
import { useI18n } from "vue-i18n";
import type { DropdownOption } from "naive-ui";
import type { VNodeChild } from "vue";

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    visible?: boolean;
    posX?: number;
    posY?: number;
    /** 右键时是否已选中文本，未选中时仅显示粘贴与全选 */
    hasSelection?: boolean;
  }>(),
  {
    visible: false,
    posX: 0,
    posY: 0,
    hasSelection: false,
  },
);

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "cut"): void;
  (e: "copy"): void;
  (e: "paste"): void;
  (e: "selectAll"): void;
}>();

/** macOS 使用 ⌘，其余平台使用 Ctrl+ */
// 使用 userAgent 判断是否为 macOS 平台，替代已弃用的 navigator.platform
const modKey = /Mac|iPod|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl+";

/** 渲染菜单项：操作名称左对齐，快捷键说明右对齐 */
function renderItem(label: string, shortcut: string): () => VNodeChild {
  return () =>
    h("div", { class: "context-menu-item" }, [
      h("span", { class: "context-menu-label" }, label),
      h("span", { class: "context-menu-shortcut" }, shortcut),
    ]);
}

const menuOptions = computed<DropdownOption[]>(() => {
  const items: DropdownOption[] = [];
  // 仅当选中文本时才显示剪切/复制（删除操作已移除）
  if (props.hasSelection) {
    items.push({ key: "cut", label: renderItem(t("EDITOR.CONTEXT_MENU.CUT"), `${modKey}X`) });
    items.push({ key: "copy", label: renderItem(t("EDITOR.CONTEXT_MENU.COPY"), `${modKey}C`) });
  }
  items.push({ key: "paste", label: renderItem(t("EDITOR.CONTEXT_MENU.PASTE"), `${modKey}V`) });
  items.push({ type: "divider" });
  items.push({ key: "selectAll", label: renderItem(t("EDITOR.CONTEXT_MENU.SELECT_ALL"), `${modKey}A`) });
  return items;
});

function handleSelect(key: string): void {
  switch (key) {
    case "cut":
      emit("cut");
      break;
    case "copy":
      emit("copy");
      break;
    case "paste":
      emit("paste");
      break;
    case "selectAll":
      emit("selectAll");
      break;
  }
  emit("update:visible", false);
}

function handleClose(): void {
  emit("update:visible", false);
}
</script>

<style lang="scss">
/* 右键菜单弹出层渲染在 body 下（teleport），scoped 样式不会生效，
   因此使用全局样式并通过 .context-menu 前缀限定作用范围 */
.context-menu.n-dropdown-menu {
  min-width: 180px;
}

.context-menu .context-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  width: 100%;
}

.context-menu .context-menu-shortcut {
  color: var(--text-quaternary);
  font-size: 12px;
}
</style>
