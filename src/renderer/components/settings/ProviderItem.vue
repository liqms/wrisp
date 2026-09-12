<template>
  <n-card justify="space-between" align="center" class="provider-item" content-style="padding: 0;">
    <n-flex align="center" class="provider-content" @click="expanded = !expanded">
      <n-flex align="center">
        <n-avatar :round="true" :src="logoPath" class="provider-avatar" />
        <n-flex align="center" class="provider-info">
          <n-text class="provider-name">{{ props.provider.name }}</n-text>
          <n-text class="provider-link" @click.stop="handleOpenLink">{{ props.provider.websiteUrl
          }}</n-text>
        </n-flex>
      </n-flex>
      <n-flex align="center" @click.stop>
        <n-switch :value="props.provider.enabled" @update:value="handleToggle" />
        <n-icon class="expand-icon">
          <ChevronDownOutline v-if="!expanded" />
          <ChevronUpOutline v-else />
        </n-icon>
      </n-flex>
    </n-flex>
    <template v-if="expanded">
      <n-divider class="divider" />
      <n-flex class="action-buttons">
        <n-button tertiary size="small" :title="t('ACTION.COMMON.EDIT')" @click.stop="handleEdit">
          {{ t('ACTION.COMMON.EDIT') }}
        </n-button>
        <n-button tertiary size="small" :title="t('ACTION.COMMON.DELETE')" @click.stop="handleDelete">
          {{ t('ACTION.COMMON.DELETE') }}
        </n-button>
      </n-flex>
    </template>
  </n-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDownOutline, ChevronUpOutline } from '@vicons/ionicons5'
import type { AIProvider } from '@/shared/types'
import { joinPath } from '@/renderer/utils/string.utils'

const { t } = useI18n()

const expanded = ref(false)

interface Props {
  provider: AIProvider
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'delete'): void
  (e: 'toggle'): void
}>()

const logoPath = computed((): string => {
  return props.provider.logoPath ? joinPath('app://', props.provider.logoPath) : ''
})

const handleToggle = (): void => {
  emit('toggle')
}

const handleEdit = (): void => {
  emit('edit')
}

const handleDelete = (): void => {
  emit('delete')
}

const handleOpenLink = async (): Promise<void> => {
  if (props.provider.websiteUrl) {
    await window.electronAPI.system.openExternal(props.provider.websiteUrl)
  }
}
</script>

<style lang="scss" scoped>
@use "@/renderer/styles/_variables.scss" as *;


.provider-content {
  flex-direction: row !important;
  justify-content: space-between !important;
  padding: 20px;
  border-radius: $radius-md $radius-md 0 0;

  &:hover {
    background-color: var(--bg-hover);
  }
}


.provider-item {
  border-radius: $radius-md;
  transition: background-color 0.2s;
  width: 100%;
  border: 1px solid transparent;
  background-color: var(--bg-secondary);


}

.provider-info {
  gap: 0 !important;
  flex-direction: column !important;
  align-items: flex-start !important;
}

.provider-link {
  font-size: $font-xs;
  color: var(--text-quaternary);
  cursor: pointer;

  &:hover {
    color: var(--primary-color);
  }
}

.provider-avatar {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
}

.provider-name {
  font-size: 14px;
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
