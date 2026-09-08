<template>
  <div
    class="template-card"
    :class="{ expanded }"
    @click="emit('toggle', item.id)"
  >
    <n-flex justify="space-between" align="center" class="card-top">
      <n-tag size="small" :bordered="false" :type="statusType">
        {{ statusText }}
      </n-tag>
      <n-button
        size="small"
        :type="actionType"
        :disabled="item.installed && !item.updateAvailable"
        @click.stop="emit('install', item)"
      >
        {{ actionText }}
      </n-button>
    </n-flex>

    <n-flex align="center" :size="10" class="card-body">
      <div class="card-icon">
        <span v-if="isSkill" class="emoji-icon">{{ item.icon }}</span>
        <component :is="iconComponent" v-else class="card-icon-svg" />
      </div>
      <div class="card-meta">
        <div class="card-title">{{ title }}</div>
        <div class="card-desc">{{ description }}</div>
      </div>
    </n-flex>

    <n-flex align="center" :size="6" :wrap="true" class="card-footer">
      <span class="card-version">v{{ item.version }}</span>
      <n-tag
        v-for="tag in tags"
        :key="tag"
        size="small"
        :bordered="false"
        type="primary"
      >
        {{ tag }}
      </n-tag>
    </n-flex>

    <n-collapse-transition>
      <div v-show="expanded" class="card-detail" @click.stop>
        <div class="detail-row">
          <span class="detail-label">
            {{ t("SETTINGS.MARKETPLACE.VERSION_CURRENT") }}
          </span>
          <span class="detail-value">{{ item.installedVersion || "—" }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">
            {{ t("SETTINGS.MARKETPLACE.VERSION_LATEST") }}
          </span>
          <span class="detail-value">v{{ item.version }}</span>
        </div>
        <div v-if="isTemplate" class="detail-row">
          <span class="detail-label">
            {{ t("SETTINGS.TEMPLATE_SETTINGS.PROFESSION") }}
          </span>
          <n-flex :size="4" align="center" class="detail-value" :wrap="true">
            <n-tag
              v-for="p in item.profession"
              :key="p"
              size="small"
              :bordered="false"
            >
              {{ t(`SETTINGS.PROFESSION.OPTION_${p.toUpperCase()}`) }}
            </n-tag>
          </n-flex>
        </div>
        <div class="detail-row detail-preview">
          <span class="detail-label">{{ t("SETTINGS.MARKETPLACE.PREVIEW") }}</span>
          <pre class="markdown-preview">{{ preview }}</pre>
        </div>
        <n-flex justify="end" :size="8" class="detail-actions">
          <n-popconfirm
            v-if="item.installed"
            :positive-text="t('SETTINGS.MARKETPLACE.UNINSTALL_CONFIRM_OK')"
            :negative-text="t('SETTINGS.MARKETPLACE.UNINSTALL_CONFIRM_CANCEL')"
            @positive-click="emit('uninstall', item)"
          >
            <template #trigger>
              <n-button size="small" type="error" quaternary>
                {{ t("SETTINGS.MARKETPLACE.UNINSTALL") }}
              </n-button>
            </template>
            {{ t("SETTINGS.MARKETPLACE.UNINSTALL_CONFIRM") }}
          </n-popconfirm>
          <n-button
            size="small"
            type="primary"
            @click="emit('install', item)"
          >
            {{
              item.installed
                ? t("SETTINGS.MARKETPLACE.UPDATE")
                : t("SETTINGS.MARKETPLACE.INSTALL")
            }}
          </n-button>
        </n-flex>
      </div>
    </n-collapse-transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useConfig } from "@/renderer/composables/useConfig";
import { resolveTemplateIcon } from "@/renderer/components/editor/slash/commands/template-icons";
import { RESOURCE_TYPE } from "@/shared/enums/resource.enums";
import { LOCALE } from "@/shared/enums";
import type { MarketplaceItem } from "@/shared/types/template.types";

const props = defineProps<{
  item: MarketplaceItem;
  expanded: boolean;
}>();

const emit = defineEmits<{
  (e: "toggle", id: string): void;
  (e: "install", item: MarketplaceItem): void;
  (e: "uninstall", item: MarketplaceItem): void;
}>();

const { t } = useI18n();
const { locale } = useConfig();
const useEn = computed(() => locale.value === LOCALE.EN);

const isSkill = computed(() => props.item.type === RESOURCE_TYPE.SKILL);
const isTemplate = computed(() => !isSkill.value);
const title = computed(() =>
  useEn.value ? props.item.title.en : props.item.title.zh,
);
const description = computed(() =>
  useEn.value ? props.item.description.en : props.item.description.zh,
);
const preview = computed(() =>
  useEn.value ? props.item.preview.en : props.item.preview.zh,
);
const tags = computed(() =>
  props.item.tags.map((tag) => (useEn.value ? tag.en : tag.zh)),
);

const iconComponent = computed(() => resolveTemplateIcon(props.item.icon));

const statusText = computed(() => {
  const { installed, updateAvailable } = props.item;
  if (installed && updateAvailable) return t("SETTINGS.MARKETPLACE.UPDATE_AVAILABLE");
  if (installed) return t("SETTINGS.MARKETPLACE.INSTALLED");
  return t("SETTINGS.MARKETPLACE.NOT_INSTALLED");
});
const statusType = computed(() => {
  const { installed, updateAvailable } = props.item;
  if (installed && updateAvailable) return "warning" as const;
  if (installed) return "info" as const;
  return "default" as const;
});
const actionText = computed(() => {
  const { installed, updateAvailable } = props.item;
  if (installed && updateAvailable) return t("SETTINGS.MARKETPLACE.UPDATE");
  if (installed) return t("SETTINGS.MARKETPLACE.INSTALLED");
  return t("SETTINGS.MARKETPLACE.INSTALL");
});
const actionType = computed(() =>
  props.item.installed ? ("default" as const) : ("primary" as const),
);
</script>

<style scoped lang="scss">
.template-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--n-border-color, rgba(128, 128, 128, 0.2));
  border-radius: 8px;
  background: var(--n-color, transparent);
  cursor: pointer;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;

  &:hover {
    border-color: var(--n-primary-color, #2080f0);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  &.expanded {
    border-color: var(--n-primary-color, #2080f0);
  }

  .card-body {
    min-width: 0;
  }

  .card-icon {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;

    .card-icon-svg {
      font-size: 22px;
    }

    .emoji-icon {
      font-size: 22px;
      line-height: 1;
    }
  }

  .card-meta {
    min-width: 0;
    flex: 1;
  }

  .card-title {
    font-weight: 600;
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-desc {
    font-size: 12px;
    color: var(--n-text-color-3, #999);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-footer {
    font-size: 12px;

    .card-version {
      color: var(--n-text-color-3, #999);
    }
  }

  .card-detail {
    border-top: 1px solid var(--n-divider-color, rgba(128, 128, 128, 0.15));
    padding-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .detail-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .detail-label {
    flex: 0 0 auto;
    width: 72px;
    color: var(--n-text-color-3, #999);
    font-size: 12px;
  }

  .detail-value {
    font-size: 12px;
    min-width: 0;
  }

  .detail-preview .markdown-preview {
    margin: 0;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 160px;
    overflow: auto;
    flex: 1;
  }

  .detail-actions {
    margin-top: 2px;
  }
}
</style>