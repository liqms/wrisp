<template>
  <n-tooltip placement="top">
    <template #trigger>
      <n-button
        size="tiny"
        round
        :color="selected ? value : disabledColor"
        @click="handleClick"
      ></n-button>
    </template>
    {{ label }}
  </n-tooltip>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { hexToRgb } from "@/shared/enums";

const props = defineProps<{
  label: string;
  value: string;
  selected?: boolean;
}>();

const emit = defineEmits(["click"] as const);

const disabledColor = computed(() => {
  return hexToRgb(props.value, 0.2);
});

const handleClick = () => {
  emit("click");
};
</script>
