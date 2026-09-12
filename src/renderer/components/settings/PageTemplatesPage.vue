<template>
  <n-scrollbar class="template-type-page card-has-scrollbar-width">
    <TemplateTypeList :type="TEMPLATE_TYPE.PAGE" />
  </n-scrollbar>
</template>

<script setup lang="ts">
import { TEMPLATE_TYPE } from "@/shared/enums/template.enums";
import TemplateTypeList from "./TemplateTypeList.vue";
</script>

<style scoped lang="scss">
.template-type-page {
  max-height: 100%;
}
</style>
