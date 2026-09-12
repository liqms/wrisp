<template>
  <n-card justify="space-between" align="center" class="template-item" content-style="padding: 0;">
    <n-flex align="center" class="template-content" @click="expanded = !expanded">
      <n-flex align="center">
        <n-flex align="center" class="template-icon">
          <component :is="resolveTemplateIcon(template.icon)" class="template-view-svg" />
        </n-flex>
        <n-flex align="center" class="template-info">
          <n-flex align="center" class="template-name-wrapper">
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
      <n-flex align="center" @click.stop>
        <n-switch :value="template.enabled" @update:value="handleToggle" />
        <n-icon class="expand-icon">
          <ChevronDownOutline v-if="!expanded" />
          <ChevronUpOutline v-else />
        </n-icon>
      </n-flex>
    </n-flex>
    <template v-if="expanded">
      <n-divider class="divider" />
      <n-flex class="action-buttons">
        <n-button tertiary size="small" :title="t('ACTION.COMMON.VIEW')" @click.stop="handleView">
          {{ t('ACTION.COMMON.VIEW') }}
        </n-button>
        <n-button v-if="!template.builtIn" tertiary size="small" :title="t('ACTION.COMMON.EDIT')"
          @click.stop="handleEdit">
          {{ t('ACTION.COMMON.EDIT') }}
        </n-button>
        <n-button v-if="!template.builtIn" tertiary size="small" :title="t('ACTION.COMMON.DELETE')"
          @click.stop="handleDelete">
          {{ t('ACTION.COMMON.DELETE') }}
        </n-button>
      </n-flex>
    </template>
  </n-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDownOutline, ChevronUpOutline } from '@vicons/ionicons5'
import type { TemplateItem } from '@/shared/types'
import { resolveTemplateIcon } from "@/renderer/components/editor/slash/commands/template-icons";

const { t } = useI18n()

const expanded = ref(false)

interface Props {
  template: TemplateItem
}

defineProps<Props>()

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

.template-content {
  flex-direction: row !important;
  justify-content: space-between !important;
  padding: 20px;
  border-radius: $radius-md $radius-md 0 0;

  &:hover {
    background-color: var(--bg-hover);
  }
}

.template-item {
  border-radius: $radius-md;
  transition: background-color 0.2s;
  width: 100%;
  border: 1px solid transparent;
  background-color: var(--bg-secondary);
}

.template-info {
  gap: $spacing-xs !important;
  flex-direction: column !important;
  align-items: flex-start !important;
}

.template-name-wrapper {
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
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.template-name {
  font-size: $font-sm;
  color: var(--text-primary);
}

.expand-icon {
  color: var(--text-third);
  cursor: pointer;
  flex-shrink: 0;
}

.divider {
  margin: 0;
}

.action-buttons {
  gap: $spacing-xs;
  padding: 20px;
}
</style>
