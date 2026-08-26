<template>
  <n-modal v-model:show="show" preset="card" :title="t('SETTINGS.TEMPLATE_SETTINGS.VIEW')"
    :style="{ maxWidth: '640px', width: 'calc(100% - 60px)' }">
    <div v-if="template" class="template-view">
      <div class="template-view-header">
        <div class="template-view-icon">
          <component :is="resolveTemplateIcon(template.icon)" class="template-view-svg" />
        </div>
        <div class="template-view-meta">
          <div class="template-view-title">{{ template.title }}</div>
          <div class="template-view-desc">{{ template.description }}</div>
        </div>
      </div>
      <n-input :value="template.markdown" type="textarea" :rows="12" readonly />
    </div>
    <template #footer>
      <n-space justify="end">
        <n-button @click="show = false">{{
          t("SETTINGS.TEMPLATE_SETTINGS.CANCEL")
        }}</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { resolveTemplateIcon } from "@/renderer/components/editor/slash/commands/template-icons";
import type { TemplateItem } from "@/shared/types/template.types";

const props = defineProps<{
  show: boolean;
  /** 待查看的模板（只读展示） */
  template: TemplateItem | null;
}>();

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
}>();

const { t } = useI18n();

const show = computed({
  get: () => props.show,
  set: (value) => emit("update:show", value),
});
</script>

<style scoped lang="scss">
.template-view-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.template-view-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.template-view-svg {
  width: 24px;
  height: 24px;
}

.template-view-meta {
  min-width: 0;
}

.template-view-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-color);
  line-height: 1.4;
}

.template-view-desc {
  font-size: 12px;
  color: var(--text-color-3);
  line-height: 1.3;
  margin-top: 2px;
}
</style>
