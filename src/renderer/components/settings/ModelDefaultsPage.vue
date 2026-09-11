<template>
  <n-scrollbar class="model-defaults-page">
    <ModelDefault />
  </n-scrollbar>
</template>

<script setup lang="ts">
import ModelDefault from "./ModelDefault.vue";
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.model-defaults-page {
  max-height: 100%;
}
</style>