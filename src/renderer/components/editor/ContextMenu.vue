<template>
  <n-dropdown
    :show="visible"
    :options="menuOptions"
    :x="posX"
    :y="posY"
    @-select="handleSelect"
    @-clickoutside="handleClose"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NDropdown } from "naive-ui";
import { useI18n } from "vue-i18n";
import type { DropdownOption } from "naive-ui";

const { t } = useI18n();

withDefaults(
  defineProps<{
    visible?: boolean;
    posX?: number;
    posY?: number;
  }>(),
  {
    visible: false,
    posX: 0,
    posY: 0,
  },
);

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "cut"): void;
  (e: "copy"): void;
  (e: "paste"): void;
  (e: "delete"): void;
  (e: "selectAll"): void;
}>();

const menuOptions = computed<DropdownOption[]>(() => [
  {
    label: t("EDITOR.CONTEXT_MENU.CUT"),
    key: "cut",
  },
  {
    label: t("EDITOR.CONTEXT_MENU.COPY"),
    key: "copy",
  },
  {
    label: t("EDITOR.CONTEXT_MENU.PASTE"),
    key: "paste",
  },
  {
    type: "divider",
  },
  {
    label: t("EDITOR.CONTEXT_MENU.DELETE"),
    key: "delete",
  },
  {
    label: t("EDITOR.CONTEXT_MENU.SELECT_ALL"),
    key: "selectAll",
  },
]);

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
    case "delete":
      emit("delete");
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