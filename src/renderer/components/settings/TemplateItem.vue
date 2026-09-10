<template>
  <n-flex justify="space-between" align="center" class="template-item">
    <n-flex align="center" class="template-info-wrapper">
      <n-flex align="center" class="template-icon">
        <component :is="resolveTemplateIcon(template.icon)" class="template-view-svg" />
      </n-flex>
      <n-flex align="center" class="template-info">
        <n-flex class="template-name-wrapper">
          <n-text class="template-name">{{ template.title }}</n-text>
          <n-flex class="template-tags-wrapper">
            <n-tag v-for="p in template.professions" :key="p" size="small" :bordered="false">
              {{ t(`SETTINGS.PROFESSION.OPTION_${p.toUpperCase()}`) }}
            </n-tag>
            <n-tag v-for="tag in template.tags" :key="tag" size="small" :bordered="false">
              {{ tag }}
            </n-tag>
          </n-flex>
        </n-flex>
        <n-text class="template-description">{{ template.description }}</n-text>
      </n-flex>
    </n-flex>
    <n-flex class="action-buttons">
      <n-flex class="action-button-more-wrapper">
        <n-button text size="small" :title="t('ACTION.COMMON.VIEW')" @click.stop="handleView">
          <n-icon>
            <EyeOutline />
          </n-icon>
        </n-button>
        <n-button v-if="!template.builtIn" text size="small" :title="t('ACTION.COMMON.EDIT')" @click.stop="handleEdit">
          <n-icon>
            <CreateOutline />
          </n-icon>
        </n-button>
        <n-button v-if="!template.builtIn" text size="small" :title="t('ACTION.COMMON.DELETE')"
          @click.stop="handleDelete">
          <n-icon>
            <TrashOutline />
          </n-icon>
        </n-button>
        <n-divider vertical />
      </n-flex>
      <n-switch :value="template.enabled" size="small" @update:value="handleToggle" />

    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { EyeOutline, CreateOutline, TrashOutline } from '@vicons/ionicons5'
import type { TemplateItem } from '@/shared/types'
import { resolveTemplateIcon } from "@/renderer/components/editor/slash/commands/template-icons";

const { t } = useI18n()

interface Props {
  template: TemplateItem
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'view'): void
  (e: 'edit'): void
  (e: 'delete'): void
  (e: 'toggle', enabled: boolean): void
}>()

const handleToggle = (enabled: boolean): void => {
  emit('toggle', enabled)
}

const handleEdit = (): void => {
  emit('edit')
}

const handleDelete = (): void => {
  emit('delete')
}

const handleView = (): void => {
  emit('view')
}


</script>

<style lang="scss" scoped>
@use "@/renderer/styles/_variables.scss" as *;

.template-item {
  padding: $spacing-md;
  border-radius: $radius-md;
  transition: background-color 0.2s;
  width: 100%;
  border: 1px solid var(--border-color);

  &:hover {
    background-color: var(--bg-hover);
    // border-color: var(--primary-color-hover);
  }
}

.template-info-wrapper {
  gap: 12px;
}

.template-info {
  gap: $spacing-xs !important;
  flex-direction: column !important;
  align-items: flex-start !important;
}



.template-title {
  gap: $spacing-xs !important;
}

.template-description {
  font-size: $font-xs;
  color: var(--text-quaternary);
}

.template-tags-wrapper {
  gap: $spacing-xs !important;
}

.template-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.template-name {
  font-size: $font-sm;
  color: var(--text-primary);
}

.action-buttons {
  gap: $spacing-xs !important;
}

.action-button-more-wrapper {
  gap: $spacing-xs !important;
  opacity: 0;
  transition: opacity 0.2s;
}

.template-item:hover .action-button-more-wrapper {
  opacity: 1;
}
</style>
