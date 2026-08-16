<template>
  <n-flex justify="space-between" align="center" class="provider-item">
    <n-flex align="center" class="provider-info-wrapper">
      <n-avatar :round="true" :src="logoPath" class="provider-avatar" />
      <n-flex align="center" class="provider-info">
        <n-flex align="center" class="provider-title">
          <n-text class="provider-name">{{ props.provider.name }}</n-text>
          <n-tag v-if="props.provider.enabled" type="success" size="tiny" round :bordered="false">
            ON
          </n-tag>
          <n-tag v-else size="tiny" round :bordered="false">
            OFF
          </n-tag>
        </n-flex>
        <n-text class="provider-link" @click="handleOpenLink">{{ props.provider.websiteUrl
          }}</n-text>
      </n-flex>
    </n-flex>
    <n-flex class="action-buttons">
      <n-button v-if="props.provider.enabled" size="small" strong secondary type="tertiary"
        @click.stop="handleToggle">{{ t('ACTION.COMMON.OFF') }}</n-button>
      <n-button v-else size="small" strong secondary type="primary" @click.stop="handleToggle">{{ t('ACTION.COMMON.ON')
        }}</n-button>
      <n-button text size="small" :title="t('ACTION.COMMON.EDIT')" @click.stop="handleEdit">
        <n-icon>
          <CreateOutline />
        </n-icon>
      </n-button>
      <n-button text size="small" :title="t('ACTION.COMMON.DELETE')" @click.stop="handleDelete">
        <n-icon>
          <TrashOutline />
        </n-icon>
      </n-button>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { CreateOutline, TrashOutline } from '@vicons/ionicons5'
import type { AIProvider } from '@/shared/types'
import { joinPath } from '@/renderer/utils/string.utils'

const { t } = useI18n()

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

.provider-item {
  padding: $spacing-md;
  border-radius: $radius-md;
  transition: background-color 0.2s;
  width: 100%;
  border: 1px solid var(--border-color);

  &:hover {
    background-color: var(--bg-tertiary);
    border-color: var(--primary-color);
  }
}

.provider-info-wrapper {
  gap: 12px;
}

.provider-info {
  gap: $spacing-xs !important;
  flex-direction: column !important;
  align-items: flex-start !important;
}

.provider-title {
  gap: $spacing-xs !important;
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

.action-buttons {
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.provider-item:hover .action-buttons {
  opacity: 1;
}

.status-button {
  font-size: 10px;
  padding: 0 8px;
  height: 22px;
}
</style>
