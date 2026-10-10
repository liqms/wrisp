
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useWikiStore } from "@/renderer/store/wiki.store";
import { useFrontendNotification } from "@/renderer/composables/useNotification";
import { logger } from "@/renderer/utils/logger.utils";

export function useWiki() {
  const store = useWikiStore();
  const { t } = useI18n();
  const notify = useFrontendNotification({ title: "", content: "" });

  // 原有
  const concepts = computed(() => store.concepts);
  const topics = computed(() => store.topics);
  const reflections = computed(() => store.reflections);
  const currentConcept = computed(() => store.currentConcept);
  const currentTopic = computed(() => store.currentTopic);
  const loading = computed(() => store.loading);
  const errorCode = computed(() => store.errorCode);
  const errorMessage = computed(() => store.errorMessage);

  // 新增
  const overview = computed(() => store.overview);
  const pendingCount = computed(() => store.pendingCount);
  const conceptCards = computed(() => store.conceptCards);
  const conceptCardsTotal = computed(() => store.conceptCardsTotal);
  const topicCards = computed(() => store.topicCards);
  const topicCardsTotal = computed(() => store.topicCardsTotal);
  const organizing = computed(() => store.organizing);
  const organizePaused = computed(() => store.organizePaused);

  // 原有方法
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

  // 新增方法
  const loadOverview = async (): Promise<void> => {
    try {
      await store.loadOverview();
      logger.info("加载概览成功");
    } catch (error) {
      logger.error("加载概览失败", { error });
    }
  };

  const loadPendingCount = async (): Promise<void> => {
    try {
      await store.loadPendingCount();
      logger.info("加载待整理数成功", { count: pendingCount.value });
    } catch (error) {
      logger.error("加载待整理数失败", { error });
    }
  };

  const loadConceptCards = async (params: {
    keyword?: string;
    orderBy?: string;
    orderDir?: "ASC" | "DESC";
    page?: number;
    pageSize?: number;
  } = {}): Promise<void> => {
    try {
      await store.loadConceptCards(params);
      logger.info("加载概念卡片成功", { count: conceptCards.value.length });
    } catch (error) {
      logger.error("加载概念卡片失败", { error });
    }
  };

  const loadTopicCards = async (params: {
    keyword?: string;
    orderBy?: string;
    orderDir?: "ASC" | "DESC";
    page?: number;
    pageSize?: number;
  } = {}): Promise<void> => {
    try {
      await store.loadTopicCards(params);
      logger.info("加载主题卡片成功", { count: topicCards.value.length });
    } catch (error) {
      logger.error("加载主题卡片失败", { error });
    }
  };

  const updateTopic = async (id: string, data: { title?: string; summary?: string }): Promise<boolean> => {
    try {
      const ok = await store.updateTopic(id, data);
      if (ok) logger.info("更新主题成功", { id });
      else logger.warn("更新主题失败", { id });
      return ok;
    } catch (error) {
      logger.error("更新主题异常", { error, id });
      return false;
    }
  };

  const deleteTopic = async (id: string): Promise<boolean> => {
    try {
      const ok = await store.deleteTopic(id);
      if (ok) logger.info("删除主题成功", { id });
      else logger.warn("删除主题失败", { id });
      return ok;
    } catch (error) {
      logger.error("删除主题异常", { error, id });
      return false;
    }
  };

  const startOrganize = async (): Promise<void> => {
    try {
      const available = await window.electronAPI.ai.isLocalAvailable();
      if (!available.data) {
        notify.warn(t("TIPS.WIKI.SMART_ORGANIZE"), t("TIPS.WIKI.LOCAL_AI_REQUIRED"));
        return;
      }
      // 主进程以 ApiResponse.error 表达「启动被拒」（例如已有一轮在跑），不抛异常
      const started = await store.startOrganize();
      if (!started) {
        notify.error(t("TIPS.WIKI.SMART_ORGANIZE"), t("TIPS.WIKI.ORGANIZE_START_FAILED"));
        return;
      }
      logger.info("启动智能整理");
    } catch (error) {
      logger.error("启动智能整理失败", { error });
      notify.error(t("TIPS.WIKI.SMART_ORGANIZE"), t("TIPS.WIKI.ORGANIZE_START_FAILED"));
    }
  };

  const cancelOrganize = async (): Promise<void> => {
    try {
      await store.cancelOrganize();
      logger.info("取消智能整理");
    } catch (error) {
      logger.error("取消智能整理失败", { error });
    }
  };

  const pauseOrganize = async (): Promise<void> => {
    try {
      await store.pauseOrganize();
      logger.info("暂停智能整理");
    } catch (error) {
      logger.error("暂停智能整理失败", { error });
    }
  };

  const resumeOrganize = async (): Promise<void> => {
    try {
      await store.resumeOrganize();
      logger.info("恢复智能整理");
    } catch (error) {
      logger.error("恢复智能整理失败", { error });
    }
  };

  const clear = (): void => {
    store.clear();
    logger.info("清除 wiki 状态");
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
    organizePaused,
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
}
