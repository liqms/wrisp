import { computed } from "vue";
import { useWikiStore } from "@/renderer/store/wiki.store";
import { logger } from "@/renderer/utils/logger.utils";

export function useWiki() {
  const store = useWikiStore();

  const concepts = computed(() => store.concepts);
  const topics = computed(() => store.topics);
  const reflections = computed(() => store.reflections);
  const currentConcept = computed(() => store.currentConcept);
  const currentTopic = computed(() => store.currentTopic);
  const loading = computed(() => store.loading);
  const errorCode = computed(() => store.errorCode);
  const errorMessage = computed(() => store.errorMessage);

  const loadConcepts = async (): Promise<void> => {
    try {
      await store.loadConcepts();
      logger.info("加载概念列表成功", { count: concepts.value.length });
    } catch (error) {
      logger.error("加载概念列表失败", { error });
    }
  };

  const loadTopics = async (): Promise<void> => {
    try {
      await store.loadTopics();
      logger.info("加载主题列表成功", { count: topics.value.length });
    } catch (error) {
      logger.error("加载主题列表失败", { error });
    }
  };

  const loadReflections = async (): Promise<void> => {
    try {
      await store.loadReflections();
      logger.info("加载反思列表成功", { count: reflections.value.length });
    } catch (error) {
      logger.error("加载反思列表失败", { error });
    }
  };

  const selectConcept = async (id: string): Promise<void> => {
    try {
      await store.selectConcept(id);
      logger.info("选中概念", { id });
    } catch (error) {
      logger.error("选中概念失败", { error, id });
    }
  };

  const selectTopic = async (id: string): Promise<void> => {
    try {
      await store.selectTopic(id);
      logger.info("选中主题", { id });
    } catch (error) {
      logger.error("选中主题失败", { error, id });
    }
  };

  const clear = (): void => {
    store.clear();
    logger.info("清除 wiki 状态");
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
}