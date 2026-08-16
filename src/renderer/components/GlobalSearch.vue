<template>
  <n-modal v-model:show="visible" preset="card" :style="{ maxWidth: '600px' }" :mask-closable="true">
    <n-input v-model:value="query" :placeholder="t('GLOBAL_SEARCH.PLACEHOLDER')" clearable autofocus size="large" />
    <n-flex v-if="query" vertical class="search-results">
      <n-text depth="3">{{ t('GLOBAL_SEARCH.NO_RESULTS') }}</n-text>
    </n-flex>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { NModal, NInput, NFlex, NText } from "naive-ui";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    visible?: boolean;
  }>(),
  {
    visible: false,
  },
);

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
}>();

const query = ref("");

const visible = computed({
  get: () => props.visible,
  set: (val) => emit("update:visible", val),
});

watch(visible, (val) => {
  if (val) {
    query.value = "";
  }
});
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.search-results {
  margin-top: $spacing-md;
  max-height: 400px;
  overflow-y: auto;
}
</style>