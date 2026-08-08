import { defineStore } from "pinia";
import { ref } from "vue";
import type { ApiResponse } from "@/shared/types";
import type { SkillListItem } from "@/shared/types/skill.types";
import { ErrorCode } from "@/shared/enums";
import { handleApiError } from "@/renderer/utils/error.utils";

export const useAiStore = defineStore("ai", () => {
  const skills = ref<SkillListItem[]>([]);
  const currentAgent = ref<string | null>(null);
  const chatMessages = ref<{ role: string; content: string }[]>([]);
  const loading = ref(false);
  const errorCode = ref<ErrorCode | null>(null);
  const errorMessage = ref<string | null>(null);

  const loadSkills = async (): Promise<void> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.skill.getSkills()) as ApiResponse<SkillListItem[]>;

      if (response.success && response.data) {
        skills.value = response.data as SkillListItem[];
      } else {
        errorCode.value = response.code;
        errorMessage.value = handleApiError(response);
      }
    } catch (error) {
      errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
      errorMessage.value = handleApiError({
        success: false,
        code: errorCode.value,
      });
    } finally {
      loading.value = false;
    }
  };

  const sendMessage = async (content: string): Promise<void> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      chatMessages.value.push({ role: "user", content });

      const response = (await window.electronAPI.ai.chatCompletion({
        messages: chatMessages.value,
      })) as ApiResponse<any>;

      if (response.success && response.data) {
        chatMessages.value.push({
          role: "assistant",
          content: response.data.content ?? "",
        });
      } else {
        errorCode.value = response.code;
        errorMessage.value = handleApiError(response);
      }
    } catch (error) {
      errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
      errorMessage.value = handleApiError({
        success: false,
        code: errorCode.value,
      });
    } finally {
      loading.value = false;
    }
  };

  const clearChat = (): void => {
    chatMessages.value = [];
    errorCode.value = null;
    errorMessage.value = null;
  };

  return {
    skills,
    currentAgent,
    chatMessages,
    loading,
    errorCode,
    errorMessage,
    loadSkills,
    sendMessage,
    clearChat,
  };
});