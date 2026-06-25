import { ref, onUnmounted } from "vue";
import type { LLMRequest, LLMStreamChunk } from "@/shared/types";

export function useAIStream() {
  const content = ref("");
  const isStreaming = ref(false);
  const error = ref<string | null>(null);
  const finishReason = ref<string | null>(null);

  let cleanupChunk: (() => void) | null = null;
  let cleanupDone: (() => void) | null = null;
  let cleanupError: (() => void) | null = null;

  async function start(request: LLMRequest) {
    // 重置状态
    content.value = "";
    error.value = null;
    finishReason.value = null;
    isStreaming.value = true;

    // 注册事件监听
    cleanupChunk = window.electronAPI.ai.onChatStreamChunk((chunk: LLMStreamChunk) => {
      if (chunk.content) {
        content.value += chunk.content;
      }
      if (chunk.finishReason) {
        finishReason.value = chunk.finishReason;
      }
    });

    cleanupDone = window.electronAPI.ai.onChatStreamDone(() => {
      isStreaming.value = false;
    });

    cleanupError = window.electronAPI.ai.onChatStreamError((err: string) => {
      error.value = err;
      isStreaming.value = false;
    });

    // 发起流式请求
    await window.electronAPI.ai.chatCompletionStream(request);
  }

  function stop() {
    cleanupChunk?.();
    cleanupDone?.();
    cleanupError?.();
    isStreaming.value = false;
  }

  onUnmounted(() => {
    stop();
  });

  return {
    content,
    isStreaming,
    error,
    finishReason,
    start,
    stop,
  };
}
