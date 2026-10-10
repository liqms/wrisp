import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useDownloadStore } from "@/renderer/store/download.store";
import { useModelStore } from "@/renderer/store/model.store";
import {
  computeModelDownloadState,
  type ModelDownloadStatus,
} from "@/renderer/utils/model-download-status";
import type {
  LocalModelFamily,
  ModelManifestEntry,
  ModelType,
} from "@/shared/types/model.types";

export interface ModelDownloadRow {
  modelId: string;
  family: LocalModelFamily;
  label: string;
  desc: string;
  status: ModelDownloadStatus;
  progress: number;
}

/** 模型清单来自主进程，展示文案仍由渲染端 i18n 提供 */
const LABEL_KEYS: Record<LocalModelFamily, string> = {
  embedding: "MODELS.EMBEDDINGS",
  reranker: "MODELS.RERANKER",
  llm: "MODELS.LANGUAGE",
};

const DESC_KEYS: Record<LocalModelFamily, string> = {
  embedding: "MODELS.EMBEDDINGS_DESC",
  reranker: "MODELS.RERANKER_DESC",
  llm: "MODELS.LANGUAGE_DESC",
};

/** family → 下载类型：本地 LLM 归入 core，其余归入 base */
const DOWNLOAD_TYPE: Record<LocalModelFamily, ModelType> = {
  embedding: "base",
  reranker: "base",
  llm: "core",
};

/**
 * 本地模型下载状态（设置页与欢迎页共用）。
 * 状态来自主进程清单 + 磁盘检查 + 下载事件流三者的合并，组件不再各自手抄模型清单。
 */
export function useModelDownloads() {
  const { t } = useI18n();
  const downloadStore = useDownloadStore();
  const modelStore = useModelStore();

  const manifest = ref<ModelManifestEntry[]>([]);
  const existsOnDisk = ref<Record<string, boolean>>({});
  const loading = ref(false);

  /** 重新拉取清单与磁盘状态 */
  async function refresh(): Promise<void> {
    loading.value = true;
    try {
      const [entries, exists] = await Promise.all([
        modelStore.fetchModelManifest(),
        modelStore.checkModelExist(),
      ]);
      if (entries.length > 0) manifest.value = entries;
      if (exists) existsOnDisk.value = exists;
    } finally {
      loading.value = false;
    }
  }

  /** 全部下载记录按组入队顺序展平：同一文件重试时，靠后的记录代表更新的状态 */
  const downloads = computed(() =>
    downloadStore.allGroupsProgress.flatMap((group) => group?.files ?? []),
  );

  const rows = computed<ModelDownloadRow[]>(() =>
    manifest.value.map((entry) => {
      const { status, progress } = computeModelDownloadState({
        manifest: entry,
        existsOnDisk: existsOnDisk.value[entry.modelId] === true,
        downloads: downloads.value,
      });
      return {
        modelId: entry.modelId,
        family: entry.family,
        label: t(LABEL_KEYS[entry.family]),
        desc: t(DESC_KEYS[entry.family]),
        status,
        progress,
      };
    }),
  );

  // 「已完成」只能由文件系统确认，因此活跃下载转空闲后重查一次磁盘状态
  watch(
    () => downloadStore.hasActiveDownloads,
    (active, wasActive) => {
      if (wasActive && !active) void refresh();
    },
  );

  /** 点击某个模型行：触发对应下载并立刻刷新一次状态 */
  async function download(family: LocalModelFamily): Promise<void> {
    await modelStore.downloadModel(DOWNLOAD_TYPE[family]);
    await refresh();
  }

  return { rows, loading, refresh, download };
}
