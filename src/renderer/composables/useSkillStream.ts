// src/renderer/composables/useSkillStream.ts
import { ref, onUnmounted } from "vue";
import type { SkillStreamChunk } from "@/shared/types/skill.types";

/** 技能 L1 流式执行 hook（订阅 skill:executeStream:chunk 事件） */
export function useSkillStream() {
  const content = ref("");
  const isStreaming = ref(false);
  const error = ref<string | null>(null);

  let cleanupChunk: (() => void) | null = null;

  async function start(skillId: string, inputs: Record<string, unknown>) {
    content.value = "";
    error.value = null;
    isStreaming.value = true;

    cleanupChunk = window.electronAPI.skill.onSkillStreamChunk((chunk: SkillStreamChunk) => {
      if (chunk.error) {
        error.value = chunk.error;
        isStreaming.value = false;
        return;
      }
      if (chunk.done) {
        isStreaming.value = false;
        return;
      }
      content.value += chunk.delta;
    });

    try {
      const res = await window.electronAPI.skill.executeSkillStream(skillId, inputs);
      if (!res.success) {
        error.value = String(res.code);
      }
    } finally {
      isStreaming.value = false;
      cleanupChunk?.();
      cleanupChunk = null;
    }
  }

  function stop() {
    cleanupChunk?.();
    cleanupChunk = null;
    isStreaming.value = false;
  }

  onUnmounted(stop);

  return { content, isStreaming, error, start, stop };
}
