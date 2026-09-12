<template>
  <n-flex class="shortcut-search card-has-scrollbar-width">
    <n-input v-model:value="keyword" clearable :placeholder="t('SETTINGS.SHORTCUT_SETTINGS.SEARCH_PLACEHOLDER')">
      <template #prefix>
        <n-icon>
          <SearchOutlined />
        </n-icon>
      </template>
    </n-input>
  </n-flex>

  <n-card size="medium" :bordered="false" @keydown="handleKeyDown" class="keymap-settings card-has-scrollbar-width">
    <n-list class="shortcut-list">
      <template v-if="filteredShortcuts.length > 0">
        <n-list-item v-for="item in filteredShortcuts" :key="item.id" class="shortcut-item">
          <n-flex align="center" justify="space-between" class="shortcut-row">
            <n-text class="shortcut-name">{{ localizedName(item.name) }}</n-text>
            <n-flex align="center" :size="8" class="shortcut-right">
              <template v-if="recordingId === item.id">
                <n-tag size="small" type="info">{{ t('SETTINGS.SHORTCUT_SETTINGS.RECORDING_HINT') }}</n-tag>
                <n-button ghost size="tiny" type="warning" @click.stop="cancelRecording">
                  {{ t('SETTINGS.SHORTCUT_SETTINGS.CANCEL_RECORD') }}
                </n-button>
              </template>
              <template v-else>
                <n-tag size="small" :bordered="false">{{ formatKeys(item.currentKeys) }}</n-tag>
                <n-button ghost size="tiny" type="primary" :title="t('SETTINGS.SHORTCUT_SETTINGS.PRESS_KEY')"
                  @click.stop="startRecording(item.id)">
                  修改
                </n-button>
              </template>
            </n-flex>
          </n-flex>
        </n-list-item>
      </template>
      <n-empty v-else :description="t('SETTINGS.SHORTCUT_SETTINGS.NO_MATCH')" class="shortcut-empty" />
    </n-list>
  </n-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { SearchOutlined, EditOutlined } from "@vicons/material";
import type { AppConfig, LocalizedText } from "@/shared/types";
import {
  resolveShortcuts,
  normalizeKeys,
  type ShortcutItem,
} from "@/renderer/store/shortcut.store";
import { useConfig } from "@/renderer/composables/useConfig";
import { useFrontendNotification } from "@/renderer/composables/useNotification";

const props = defineProps<{ config: AppConfig | null }>();

const { t, locale } = useI18n();
const notify = useFrontendNotification({ title: "", content: "" });
const { updateShortcuts } = useConfig();

const shortcuts = ref<ShortcutItem[]>(resolveShortcuts(props.config?.shortcuts));
const recordingId = ref<string | null>(null);
const keyword = ref("");

/** 按当前界面语言解析双语名称 */
const localizedName = (name: LocalizedText) => (locale.value === "enUS" ? name.en : name.zh);

/** 按名称/组合键过滤后的快捷键列表 */
const filteredShortcuts = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return shortcuts.value;
  return shortcuts.value.filter((s) => {
    const name = localizedName(s.name).toLowerCase();
    const keys = formatKeys(s.currentKeys).toLowerCase();
    return name.includes(kw) || keys.includes(kw);
  });
});

// 配置变化（如外部修改 / 重开设置）时同步回显
watch(
  () => props.config?.shortcuts,
  (saved) => {
    shortcuts.value = resolveShortcuts(saved);
    recordingId.value = null;
  },
  { immediate: true },
);

const startRecording = (id: string) => {
  recordingId.value = id;
};

const cancelRecording = () => {
  recordingId.value = null;
};

const isConflict = (keys: string, excludeId: string) => {
  const normalized = normalizeKeys(keys);
  return shortcuts.value.some(
    (s) => s.id !== excludeId && normalizeKeys(s.currentKeys) === normalized,
  );
};

const handleKeyDown = async (e: KeyboardEvent) => {
  if (!recordingId.value) return;
  e.preventDefault();
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");
  const key =
    e.key === "Control" || e.key === "Alt" || e.key === "Shift" || e.key === "Meta"
      ? ""
      : e.key.length === 1
        ? e.key.toUpperCase()
        : e.key;
  if (key) parts.push(key);
  if (parts.length < 2) return;

  const newKeys = parts.join("+");
  const target = shortcuts.value.find((s) => s.id === recordingId.value);
  if (!target) return;

  if (isConflict(newKeys, target.id)) {
    notify.warn("", t("SETTINGS.SHORTCUT_SETTINGS.CONFLICT_WARNING"));
    return;
  }

  target.currentKeys = newKeys;
  const saved = shortcuts.value.map(({ id, name, currentKeys }) => ({
    id,
    name,
    keys: currentKeys,
  }));
  const ok = await updateShortcuts(saved);
  if (!ok) {
    notify.error("", t("SETTINGS.SHORTCUT_SETTINGS.SAVE_FAILED"));
  }
  recordingId.value = null;
};

const formatKeys = (keys: string) => keys.replace(/\+/g, " + ");
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables.scss" as *;

.shortcut-search {
  margin-bottom: 16px;
}



.keymap-settings {
  max-height: 100%;
  background-color: var(--bg-secondary);
  border-radius: $radius-md;
}

.shortcut-list {
  height: 100%;
  background-color: var(--bg-secondary);
}

.shortcut-item {
  &:first-child {
    padding-top: 0;
  }

  &:last-child {
    padding-bottom: 0;
  }
}

.shortcut-name {
  min-width: 96px;
  color: var(--text-primary);
  font-size: 14px;
}

.shortcut-row {
  width: 100%;

}

.shortcut-empty {
  padding: 32px 0;
}
</style>
