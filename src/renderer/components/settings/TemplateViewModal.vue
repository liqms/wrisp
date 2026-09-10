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
      <div class="template-view-fields">
        <div class="field-row">
          <span class="field-label">{{ t("SETTINGS.TEMPLATE_SETTINGS.META_ID") }}</span>
          <span class="field-value field-mono">{{ template.id }}</span>
        </div>
        <div class="field-row">
          <span class="field-label">{{ t("SETTINGS.TEMPLATE_SETTINGS.TYPE") }}</span>
          <n-tag size="small" :bordered="false" :type="template.builtIn ? 'info' : 'warning'">
            {{ template.builtIn
              ? t("SETTINGS.TEMPLATE_SETTINGS.BUILT_IN")
              : t("SETTINGS.TEMPLATE_SETTINGS.CUSTOM") }}
          </n-tag>
        </div>
        <div class="field-row">
          <span class="field-label">{{ t("SETTINGS.TEMPLATE_SETTINGS.VERSION") }}</span>
          <span class="field-value">{{ template.version || "—" }}</span>
        </div>
        <div class="field-row">
          <span class="field-label">{{ t("SETTINGS.TEMPLATE_SETTINGS.PROFESSION") }}</span>
          <n-flex :size="4" align="center" class="field-tags">
            <n-tag v-for="p in template.professions" :key="p" size="small" :bordered="false">
              {{ t(`SETTINGS.PROFESSION.OPTION_${p.toUpperCase()}`) }}
            </n-tag>
          </n-flex>
        </div>
        <div v-if="template.tags.length > 0" class="field-row">
          <span class="field-label">{{ t("SETTINGS.TEMPLATE_SETTINGS.META_TAGS") }}</span>
          <n-flex :size="4" align="center" class="field-tags">
            <n-tag v-for="tag in template.tags" :key="tag" size="small" :bordered="false"
              type="primary">
              {{ tag }}
            </n-tag>
          </n-flex>
        </div>
      </div>
      <n-input :value="template.markdown" type="textarea" :rows="12" readonly />
    </div>
    <template #footer>
      <n-space justify="end">
        <n-button @click="show = false">{{
          t("ACTION.COMMON.CANCEL")
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
  color: var(--text-third);
  line-height: 1.3;
  margin-top: 2px;
}

.template-view-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  margin-bottom: 16px;
  border-radius: 8px;
  background: var(--bg-secondary);
}

.field-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  line-height: 1.5;
}

.field-label {
  flex-shrink: 0;
  width: 56px;
  color: var(--text-third);
}

.field-value {
  color: var(--text-color);
  min-width: 0;
  word-break: break-all;
}

.field-mono {
  font-family: var(--font-mono, monospace);
}

.field-tags {
  min-width: 0;
}
</style>
