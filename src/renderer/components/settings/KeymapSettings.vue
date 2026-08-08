<template>
  <n-card size="small" :title="t('SETTINGS.KEYMAP')" tabindex="0" @keydown="handleKeyDown">
    <n-list>
      <n-list-item v-for="item in shortcuts" :key="item.id">
        <n-flex align="center" justify="space-between" class="shortcut-row">
          <n-text>{{ item.labelKey }}</n-text>
          <n-flex align="center" :size="8">
            <template v-if="recordingId === item.id">
              <n-tag type="info">{{ t('SETTINGS.SHORTCUT_SETTINGS.RECORDING_HINT') }}</n-tag>
              <n-button size="tiny" type="warning" @click.stop="cancelRecording">
                {{ t('SETTINGS.SHORTCUT_SETTINGS.CANCEL_RECORD') }}
              </n-button>
            </template>
            <template v-else>
              <n-tag size="small" :bordered="false">{{ formatKeys(item.currentKeys) }}</n-tag>
              <n-button size="tiny" ghost type="primary" @click.stop="startRecording(item.id)">
                {{ t('SETTINGS.SHORTCUT_SETTINGS.PRESS_KEY') }}
              </n-button>
            </template>
          </n-flex>
        </n-flex>
      </n-list-item>
    </n-list>
  </n-card>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import type { AppConfig } from "@/shared/types";
import { useConfig } from "@/renderer/composables/useConfig";

defineProps<{ config: AppConfig | null }>();

const { t } = useI18n();
const configStore = useConfig();

interface ShortcutItem {
  id: string;
  labelKey: string;
  defaultKeys: string;
  currentKeys: string;
}

const defaultShortcuts: ShortcutItem[] = [
  { id: "global.capture", labelKey: "快速记录", defaultKeys: "Ctrl+Shift+C", currentKeys: "Ctrl+Shift+C" },
  { id: "global.search", labelKey: "搜索", defaultKeys: "Ctrl+Shift+F", currentKeys: "Ctrl+Shift+F" },
  { id: "global.settings", labelKey: "设置", defaultKeys: "Ctrl+,", currentKeys: "Ctrl+," },
  { id: "global.copy", labelKey: t("SETTINGS.SHORTCUT_SETTINGS.COPY"), defaultKeys: "Ctrl+C", currentKeys: "Ctrl+C" },
  { id: "global.paste", labelKey: t("SETTINGS.SHORTCUT_SETTINGS.PASTE"), defaultKeys: "Ctrl+V", currentKeys: "Ctrl+V" },
];

const shortcuts = ref<ShortcutItem[]>([...defaultShortcuts]);
const recordingId = ref<string | null>(null);

const startRecording = (id: string) => {
  recordingId.value = id;
};

const cancelRecording = () => {
  recordingId.value = null;
};

const isConflict = (keys: string, excludeId: string) => {
  return shortcuts.value.some(
    (s) => s.id !== excludeId && s.currentKeys.toLowerCase() === keys.toLowerCase(),
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
  if (isConflict(newKeys, recordingId.value)) return;
  const item = shortcuts.value.find((s) => s.id === recordingId.value);
  if (item) {
    item.currentKeys = newKeys;
    await configStore.setValue(
      "shortcuts",
      shortcuts.value.map(({ id, currentKeys }) => ({ id, keys: currentKeys })),
    );
  }
  recordingId.value = null;
};

const formatKeys = (keys: string) => keys.replace(/\+/g, " + ");
</script>

<style scoped lang="scss">
.shortcut-row {
  width: 100%;
  padding: 4px 0;
}
</style>