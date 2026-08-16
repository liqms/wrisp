<template>
  <n-flex class="welcome-features-item">
    <n-icon :color="iconColor" size="48">
      <component :is="icon" />
    </n-icon>
    <n-text class="welcome-features-title">
      {{ title }}
    </n-text>
    <n-text class="welcome-features-desc">
      {{ desc }}
    </n-text>
  </n-flex>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Component } from "vue";
import { hexToRgb } from "@/shared/enums/themeColor.enums";
import { useThemeVars } from "naive-ui";

const themeVars = useThemeVars();
const iconColor = computed(() => hexToRgb(themeVars.value.primaryColor, 0.5));
defineProps<{
  icon: Component;
  title: string;
  desc: string;
}>();
</script>
<style lang="scss" scoped>
@use "@/renderer/styles/_variables" as *;

.welcome-features-item {
  align-items: center;
  flex-direction: column !important;
  gap: $spacing-xs !important;
  width: 190px;
  height: 160px;
  text-align: center;
  background-color: var(--bg-secondary);
  border-radius: $radius-lg;
  padding: $spacing-md;
}


.welcome-features-title {
  font-size: $font-sm;
  color: var(--text-secondary);
  font-weight: $font-semibold;
}

.welcome-features-desc {
  font-size: $font-xs;
  color: var(--text-third);
}

@media (max-width: $breakpoint-lg) {
  .welcome-features-item {
    max-width: 160px;
  }
}
</style>
