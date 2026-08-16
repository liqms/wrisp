<template>
  <n-card :title="title" size="small" class="ai-panel">
    <n-flex vertical>
      <!-- 对话消息区 -->
      <n-scrollbar ref="scrollbarRef" class="message-area">
        <n-flex vertical>
          <div v-for="msg in messages" :key="msg.id" class="message" :class="msg.role">
            <n-markdown :source="msg.content" />
          </div>
        </n-flex>
      </n-scrollbar>

      <!-- 输入区 -->
      <n-flex class="input-area">
        <n-input v-model:value="inputText" :placeholder="t('PROJECT.AI_ASSISTANT.PLACEHOLDER')" size="small"
          @keydown.enter="handleSend" />
        <n-button type="primary" size="small" @click="handleSend">
          {{ t('PROJECT.AI_ASSISTANT.SEND') }}
        </n-button>
      </n-flex>
    </n-flex>
  </n-card>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NCard, NFlex, NScrollbar, NInput, NButton } from "naive-ui";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

withDefaults(
  defineProps<{
    title?: string;
    messages?: ChatMessage[];
  }>(),
  {
    title: "",
    messages: () => [],
  },
);

const emit = defineEmits<{
  (e: "send", text: string): void;
}>();

const inputText = ref("");

function handleSend(): void {
  const text = inputText.value.trim();
  if (!text) return;
  emit("send", text);
  inputText.value = "";
}
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.ai-panel {
  height: 100%;
  display: flex;
  flex-direction: column;

  :deep(.n-card__content) {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
}

.message-area {
  flex: 1;
  margin-bottom: $spacing-sm;
  padding: $spacing-xs;
}

.message {
  padding: $spacing-xs $spacing-sm;
  border-radius: $radius-sm;

  &.user {
    background-color: var(--primary-color);
    color: #fff;
    align-self: flex-end;
  }

  &.assistant {
    background-color: var(--bg-secondary);
    align-self: flex-start;
  }
}

.message-content {
  white-space: pre-wrap;
  word-break: break-word;
}

.input-area {
  gap: $spacing-xs;
}
</style>