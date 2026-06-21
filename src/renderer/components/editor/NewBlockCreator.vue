<template>
  <n-flex class="new-block-creator" :class="{
    'is-focused': isFocused,
    'has-content': hasContent,
  }">
    <n-flex class="input-area" align="flex-end">
      <TiptapEditor ref="editorRef" :placeholder="$t('TIPS.CAPTURE.INPUT_CAPTURE_TIP')" :slashCommand="false"
        :min-height="100" :max-height="200" @enter="submit" @focus="isFocused = true" @blur="isFocused = false" />

      <n-button class="send-btn" :class="{ 'is-active': hasContent }" :disabled="!hasContent || submitting" circle
        :size="'small'" @click="submit" :title="$t('TIPS.CAPTURE.SEND')">
        <template #icon>
          <n-icon :size="18">
            <ArrowUp />
          </n-icon>
        </template>
      </n-button>

    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { NButton, NFlex, NIcon } from "naive-ui";
import { ArrowUp } from "@vicons/ionicons5";
import TiptapEditor from "./TiptapEditor.vue";
import { useCapture } from "@/renderer/composables/useCapture";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const { createCapture, getCapturesByDateRange } = useCapture();

const isFocused = ref(false);
const submitting = ref(false);
const editorRef = ref<InstanceType<typeof TiptapEditor> | null>(null);

const hasContent = computed(() => {
  const text = editorRef.value?.getText() ?? "";
  return text.trim().length > 0;
});

const submit = async () => {
  if (!editorRef.value) return;
  const text = editorRef.value.getText().trim();
  if (!text || submitting.value) return;
  submitting.value = true;
  try {
    const md = editorRef.value.getMarkdown();
    const id = await createCapture({ content: md });
    if (id) {
      // 刷新当天记录，确保新建项能立即展示
      const now = new Date();
      const endDate = now.toISOString().slice(0, 10);
      const startDate = endDate;
      await getCapturesByDateRange(startDate, endDate);
    }
    editorRef.value.clear();
  } finally {
    submitting.value = false;
  }
};

defineExpose({
  focus: () => editorRef.value?.focus(),
});
</script>

<style lang="scss" scoped>
@use "@/renderer/styles/_variables" as *;

.new-block-creator {
  width: 100%;
  transition: all $transition-base ease;
}

.input-area {
  gap: $spacing-sm;
  padding: $spacing-md;
  border-radius: $radius-xl;
  border: 1.5px solid var(--border-color);
  width: 100%;
  height: fit-content;
  background: var(--bg-secondary);
  transition: all $transition-base ease;
  // box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  box-shadow: var(--shadow-sm);
}

.is-focused {
  .input-area {
    border-color: var(--primary-color);
    //   box-shadow:
    //     0 0 0 4px rgba(79, 110, 247, 0.08),
    //     0 2px 8px rgba(0, 0, 0, 0.06);
    // }
    box-shadow: var(--shadow-sm);
  }

}

.has-content {
  .input-area {
    border-color: var(--primary-color);
  }
}

.is-focused.has-content {
  .input-area {
    border-color: var(--primary-color);
  }
}

.send-btn {
  flex-shrink: 0;
  margin-bottom: 1px;
}
</style>
