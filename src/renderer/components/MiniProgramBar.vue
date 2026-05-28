<template>
  <n-button strong secondary class="mini-program-bar" :class="{ 'is-selected': selected }" :type="selected ? 'primary' : 'tertiary'" 
    @click="$emit('click')">
    <n-avatar small round :src="icon" class="icon-wrapper" />
    <n-text class="label">{{ label }}</n-text>
  </n-button>
</template>

<script setup lang="ts">

interface Props {
  icon: string
  label: string
  selected?: boolean
}

withDefaults(defineProps<Props>(), {
  selected: false
})

defineEmits<{
  click: []
}>()
</script>

<style lang="scss" scoped>
@use '@/renderer/styles/_variables.scss' as *;

$icon-size: 18px;

.mini-program-bar {
  align-items: center;
  padding: $spacing-sm;
  border-radius: $radius-md;
  cursor: pointer;

  .icon-wrapper {
    width: $icon-size;
    height: $icon-size;
  }

  .label {
    opacity: 1;
    max-width: 200px;
    font-size: $font-sm;
    border-left: 1px solid var(--border-color);
    margin-left: $spacing-xs;
    padding-left: $spacing-xs;
  }

  &.is-selected {
    .label {
      color: var(--primary-text-color);
    }
  }

  // &:hover {
  //   background-color: var(--primary-color);
  //   color: var(--primary-text-color);
  // }
}

@media (max-width: $breakpoint-xs) {
  .mini-program-bar {
    gap: 0;
    .label {
      opacity: 0;
      max-width: 0;
      overflow: hidden;
    }

    &:hover .label {
      opacity: 1;
      max-width: 200px;
      margin-left: $spacing-xs;
      padding-left: $spacing-xs;
      border-left: 1px solid var(--border-color);
    }
  }
}
</style>