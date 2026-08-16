<template>
  <n-card size="small" :title="t('SETTINGS.KEYMAP')" tabindex="0" @keydown="handleKeyDown">
    <n-list>
      <n-list-item v-for="item in shortcuts" :key="item.id">
        <n-flex align="center" justify="space-between" class="shortcut-row">
          <n-text>{{ t(item.labelKey) }}</n-text>
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
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useMessage } from "naive-ui";
import type { AppConfig } from "@/shared/types";
import {
  resolveShortcuts,
  normalizeKeys,
  type ShortcutItem,
} from "@/renderer/store/shortcut.store";
import { useConfig } from "@/renderer/composables/useConfig";

const props = defineProps<{ config: AppConfig | null }>();

const { t } = useI18n();
const message = useMessage();
const { updateShortcuts } = useConfig();

const shortcuts = ref<ShortcutItem[]>(resolveShortcuts(props.config?.shortcuts));
const recordingId = ref<string | null>(null);

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
    message.warning(t("SETTINGS.SHORTCUT_SETTINGS.CONFLICT_WARNING"));
    return;
  }

  target.currentKeys = newKeys;
  const saved = shortcuts.value.map(({ id, currentKeys }) => ({ id, keys: currentKeys }));
  const ok = await updateShortcuts(saved);
  if (!ok) {
    message.error(t("SETTINGS.SHORTCUT_SETTINGS.SAVE_FAILED"));
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
