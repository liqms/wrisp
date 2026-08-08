import { defineStore } from "pinia";
import { ref } from "vue";
import type { ApiResponse } from "@/shared/types";
import type {
  Concept,
  ConceptWithBlocks,
  Topic,
  TopicWithConceptsAndBlocks,
  Reflection,
  ReflectionWithBlocks,
} from "@/main/types/db";
import type { PaginationResult } from "@/shared/utils/pagination";
import { ErrorCode } from "@/shared/enums";
import { handleApiError } from "@/renderer/utils/error.utils";

export const useWikiStore = defineStore("wiki", () => {
  const concepts = ref<Concept[]>([]);
  const topics = ref<Topic[]>([]);
  const reflections = ref<Reflection[]>([]);
  const currentConcept = ref<ConceptWithBlocks | null>(null);
  const currentTopic = ref<TopicWithConceptsAndBlocks | null>(null);
  const loading = ref(false);
  const errorCode = ref<ErrorCode | null>(null);
  const errorMessage = ref<string | null>(null);

  const loadConcepts = async (): Promise<void> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.concept.concept.list({
        pageSize: 50,
      })) as ApiResponse<PaginationResult<Concept>>;

      if (response.success && response.data) {
        concepts.value = (response.data as PaginationResult<Concept>).data;
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

  const loadTopics = async (): Promise<void> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.topic.topic.list({
        pageSize: 50,
      })) as ApiResponse<PaginationResult<Topic>>;

      if (response.success && response.data) {
        topics.value = (response.data as PaginationResult<Topic>).data;
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

  const loadReflections = async (): Promise<void> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.reflection.reflection.list({
        pageSize: 50,
      })) as ApiResponse<PaginationResult<Reflection>>;

      if (response.success && response.data) {
        reflections.value = (response.data as PaginationResult<Reflection>).data;
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

  const selectConcept = async (id: string): Promise<void> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.concept.concept.detail(
        id,
      )) as ApiResponse<ConceptWithBlocks | null>;

      if (response.success && response.data) {
        currentConcept.value = response.data as ConceptWithBlocks;
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

  const selectTopic = async (id: string): Promise<void> => {
    loading.value = true;
    errorCode.value = null;
    errorMessage.value = null;

    try {
      const response = (await window.electronAPI.topic.topic.detail(
        id,
      )) as ApiResponse<TopicWithConceptsAndBlocks | null>;

      if (response.success && response.data) {
        currentTopic.value = response.data as TopicWithConceptsAndBlocks;
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

  const clear = (): void => {
    concepts.value = [];
    topics.value = [];
    reflections.value = [];
    currentConcept.value = null;
    currentTopic.value = null;
    errorCode.value = null;
    errorMessage.value = null;
  };

  return {
    concepts,
    topics,
    reflections,
    currentConcept,
    currentTopic,
    loading,
    errorCode,
    errorMessage,
    loadConcepts,
    loadTopics,
    loadReflections,
    selectConcept,
    selectTopic,
    clear,
  };
});