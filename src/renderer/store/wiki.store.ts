
import { defineStore } from "pinia";
import { ref } from "vue";
import type { ApiResponse } from "@/shared/types";
import type {
  WikiOverview,
  WikiPendingCount,
  ConceptCard,
  TopicCard,
} from "@/shared/types";
import type {
  Concept,
  ConceptWithBlocks,
  Topic,
  TopicWithConceptsAndBlocks,
  Reflection,
} from "@/main/types/db";
import type { PaginationResult } from "@/shared/utils/pagination";
import { ErrorCode } from "@/shared/enums";
import { handleApiError } from "@/renderer/utils/error.utils";

export const useWikiStore = defineStore("wiki", () => {
  // 原有状态
  const concepts = ref<Concept[]>([]);
  const topics = ref<Topic[]>([]);
  const reflections = ref<Reflection[]>([]);
  const currentConcept = ref<ConceptWithBlocks | null>(null);
  const currentTopic = ref<TopicWithConceptsAndBlocks | null>(null);
  const loading = ref(false);
  const errorCode = ref<ErrorCode | null>(null);
  const errorMessage = ref<string | null>(null);

  // Wiki 新增状态
  const overview = ref<WikiOverview | null>(null);
  const pendingCount = ref<number>(0);
  const conceptCards = ref<ConceptCard[]>([]);
  const conceptCardsTotal = ref(0);
  const topicCards = ref<TopicCard[]>([]);
  const topicCardsTotal = ref(0);
  const organizing = ref(false);

  // === 原有方法 ===

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
    } catch {
      errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
      errorMessage.value = handleApiError({ success: false, code: errorCode.value });
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
    } catch {
      errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
      errorMessage.value = handleApiError({ success: false, code: errorCode.value });
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
    } catch {
      errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
      errorMessage.value = handleApiError({ success: false, code: errorCode.value });
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
    } catch {
      errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
      errorMessage.value = handleApiError({ success: false, code: errorCode.value });
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
    } catch {
      errorCode.value = ErrorCode.COMMON_ACTION_ERROR;
      errorMessage.value = handleApiError({ success: false, code: errorCode.value });
    } finally {
      loading.value = false;
    }
  };

  // === Wiki 新增方法 ===

  const loadOverview = async (): Promise<void> => {
    try {
      const response = (await window.electronAPI.wiki.wiki.overview()) as ApiResponse<WikiOverview>;
      if (response.success && response.data) {
        overview.value = response.data as WikiOverview;
      }
    } catch {
      // 静默失败，概览不影响核心功能
    }
  };

  const loadPendingCount = async (): Promise<void> => {
    try {
      const response = (await window.electronAPI.wiki.wiki.pendingCount()) as ApiResponse<WikiPendingCount>;
      if (response.success && response.data) {
        pendingCount.value = (response.data as WikiPendingCount).pendingChunks;
      }
    } catch {
      // 静默失败
    }
  };

  const loadConceptCards = async (params: {
    keyword?: string;
    orderBy?: string;
    orderDir?: "ASC" | "DESC";
    page?: number;
    pageSize?: number;
  } = {}): Promise<void> => {
    loading.value = true;
    try {
      const response = (await window.electronAPI.wiki.wiki.conceptCards(params)) as ApiResponse<{ data: ConceptCard[]; total: number }>;
      if (response.success && response.data) {
        conceptCards.value = (response.data as { data: ConceptCard[]; total: number }).data;
        conceptCardsTotal.value = (response.data as { data: ConceptCard[]; total: number }).total;
      }
    } catch {
      // 静默失败
    } finally {
      loading.value = false;
    }
  };

  const loadTopicCards = async (params: {
    keyword?: string;
    orderBy?: string;
    orderDir?: "ASC" | "DESC";
    page?: number;
    pageSize?: number;
  } = {}): Promise<void> => {
    loading.value = true;
    try {
      const response = (await window.electronAPI.wiki.wiki.topicCards(params)) as ApiResponse<{ data: TopicCard[]; total: number }>;
      if (response.success && response.data) {
        topicCards.value = (response.data as { data: TopicCard[]; total: number }).data;
        topicCardsTotal.value = (response.data as { data: TopicCard[]; total: number }).total;
      }
    } catch {
      // 静默失败
    } finally {
      loading.value = false;
    }
  };

  const updateTopic = async (id: string, data: { title?: string; summary?: string }): Promise<boolean> => {
    try {
      const response = (await window.electronAPI.wiki.topic.update(id, data)) as ApiResponse<boolean>;
      return response.success;
    } catch {
      return false;
    }
  };

  const deleteTopic = async (id: string): Promise<boolean> => {
    try {
      const response = (await window.electronAPI.wiki.topic.delete(id)) as ApiResponse<boolean>;
      return response.success;
    } catch {
      return false;
    }
  };

  // === 智能整理 ===

  const startOrganize = async (): Promise<void> => {
    try {
      organizing.value = true;
      await window.electronAPI.smartTask.start();
    } catch {
      organizing.value = false;
    }
  };

  const cancelOrganize = async (): Promise<void> => {
    try {
      await window.electronAPI.smartTask.cancel();
      organizing.value = false;
    } catch {
      // 静默失败
    }
  };

  const pauseOrganize = async (): Promise<void> => {
    try {
      await window.electronAPI.smartTask.pause();
    } catch {
      // 静默失败
    }
  };

  const resumeOrganize = async (): Promise<void> => {
    try {
      await window.electronAPI.smartTask.resume();
    } catch {
      // 静默失败
    }
  };

  const clear = (): void => {
    concepts.value = [];
    topics.value = [];
    reflections.value = [];
    currentConcept.value = null;
    currentTopic.value = null;
    overview.value = null;
    pendingCount.value = 0;
    conceptCards.value = [];
    conceptCardsTotal.value = 0;
    topicCards.value = [];
    topicCardsTotal.value = 0;
    organizing.value = false;
    errorCode.value = null;
    errorMessage.value = null;
  };

  return {
    // 原有状态
    concepts,
    topics,
    reflections,
    currentConcept,
    currentTopic,
    loading,
    errorCode,
    errorMessage,
    // 新增状态
    overview,
    pendingCount,
    conceptCards,
    conceptCardsTotal,
    topicCards,
    topicCardsTotal,
    organizing,
    // 原有方法
    loadConcepts,
    loadTopics,
    loadReflections,
    selectConcept,
    selectTopic,
    // 新增方法
    loadOverview,
    loadPendingCount,
    loadConceptCards,
    loadTopicCards,
    updateTopic,
    deleteTopic,
    startOrganize,
    cancelOrganize,
    pauseOrganize,
    resumeOrganize,
    clear,
  };
});
