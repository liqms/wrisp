<template>
  <n-scrollbar class="smart-task-settings card-has-scrollbar-width">
    <!-- 资源占用：语义链接是 CPU 形态下最贵的阶段，这里给的都限流旋钮 -->
    <n-card size="medium" :bordered="false" class="setting-card">
      <n-text class="setting-group">{{ t("SETTINGS.SMART_TASK.GROUP_RESOURCE") }}</n-text>

      <n-flex class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{ t("SETTINGS.SMART_TASK.LINK_CONCURRENCY") }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.SMART_TASK.LINK_CONCURRENCY_DESC") }}</n-text>
        </n-flex>
        <n-input-number class="setting-input" :value="smartTask.semanticLinkConcurrency" :min="1" :max="4"
          :precision="0" size="small" @update:value="onConcurrencyChange" />
      </n-flex>

      <n-flex class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{ t("SETTINGS.SMART_TASK.CPU_BOUND_PARALLEL") }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.SMART_TASK.CPU_BOUND_PARALLEL_DESC") }}</n-text>
        </n-flex>
        <n-switch class="setting-switch" :value="smartTask.allowCpuBoundParallel"
          @update:value="(v: boolean) => update('allowCpuBoundParallel', v)" />
      </n-flex>

      <n-flex v-for="field in THREAD_FIELDS" :key="field.key" class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{ t(field.labelKey) }}</n-text>
          <n-text class="setting-desc">{{ t(field.descKey) }}</n-text>
        </n-flex>
        <n-flex align="center" :size="8" class="thread-control">
          <n-switch size="small" :value="smartTask[field.key] === null"
            @update:value="(auto: boolean) => update(field.key, auto ? null : field.fallback)" />
          <n-text class="setting-desc">{{ t("SETTINGS.SMART_TASK.THREAD_AUTO") }}</n-text>
          <n-input-number class="setting-input" :value="smartTask[field.key] ?? undefined" :min="1" :max="32"
            :precision="0" size="small" :disabled="smartTask[field.key] === null"
            @update:value="(v: number | null) => update(field.key, v ?? null)" />
        </n-flex>
      </n-flex>

      <!-- 实际生效值来自主进程同一个 resolveThreadBudget，避免 UI 与 Worker 各说一套 -->
      <n-text v-if="threadBudget" class="setting-desc thread-status">
        {{ t("SETTINGS.SMART_TASK.THREAD_EFFECTIVE", {
          onnx: threadBudget.onnx,
          llm: threadBudget.llm,
          cores: threadBudget.logicalCores,
        }) }}
      </n-text>
      <n-text class="setting-desc thread-status">{{ t("SETTINGS.SMART_TASK.RELOAD_HINT") }}</n-text>
    </n-card>

    <n-card size="medium" :bordered="false" class="setting-card">
      <n-text class="setting-group">{{ t("SETTINGS.SMART_TASK.GROUP_SEMANTIC_LINK") }}</n-text>

      <n-flex class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{ t("SETTINGS.SMART_TASK.ANN_TOP_K") }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.SMART_TASK.ANN_TOP_K_DESC") }}</n-text>
        </n-flex>
        <n-input-number class="setting-input" :value="smartTask.annTopK" :min="1" :max="32" :precision="0" size="small"
          @update:value="onAnnTopKChange" />
      </n-flex>

      <n-flex class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{ t("SETTINGS.SMART_TASK.RERANK_TOP_K") }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.SMART_TASK.RERANK_TOP_K_DESC") }}</n-text>
        </n-flex>
        <n-input-number class="setting-input" :value="smartTask.rerankTopK" :min="1" :max="smartTask.annTopK"
          :precision="0" size="small" @update:value="(v: number | null) => update('rerankTopK', clampRerank(v))" />
      </n-flex>
    </n-card>

    <n-card size="medium" :bordered="false" class="setting-card">
      <n-text class="setting-group">{{ t("SETTINGS.SMART_TASK.GROUP_CONCEPT") }}</n-text>

      <n-flex class="setting-row">
        <n-flex align="center" class="setting-content">
          <n-text class="setting-label">{{ t("SETTINGS.SMART_TASK.CONCEPT_WINDOW") }}</n-text>
          <n-text class="setting-desc">{{ t("SETTINGS.SMART_TASK.CONCEPT_WINDOW_DESC") }}</n-text>
        </n-flex>
        <n-input-number class="setting-input" :value="smartTask.conceptInputWindowChars" :min="400" :max="4000"
          :step="100" :precision="0" size="small"
          @update:value="(v: number | null) => update('conceptInputWindowChars', v ?? DEFAULT_SMART_TASK_CONFIG.conceptInputWindowChars)" />
      </n-flex>
    </n-card>
  </n-scrollbar>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useConfig } from "@/renderer/composables/useConfig";
import { useModel } from "@/renderer/composables/useModel";
import { DEFAULT_SMART_TASK_CONFIG } from "@/shared/constants/smart-task.constants";
import type { SmartTaskConfig } from "@/shared/types";
import type { ThreadBudgetInfo } from "@/shared/types/model.types";

const { t } = useI18n();
const { smartTask, updateSmartTaskValue } = useConfig();
const { getThreadBudget } = useModel();

/** 主进程回报的实际生效线程数；null = 尚未取到 */
const threadBudget = ref<ThreadBudgetInfo | null>(null);

/** 线程类字段：null 表示「自动」，关掉自动开关时填的初始值 */
interface ThreadField {
  key: "onnxIntraOpThreads" | "llmMaxThreads";
  labelKey: string;
  descKey: string;
  fallback: number;
}

const THREAD_FIELDS: ThreadField[] = [
  {
    key: "onnxIntraOpThreads",
    labelKey: "SETTINGS.SMART_TASK.ONNX_THREADS",
    descKey: "SETTINGS.SMART_TASK.ONNX_THREADS_DESC",
    fallback: 4,
  },
  {
    key: "llmMaxThreads",
    labelKey: "SETTINGS.SMART_TASK.LLM_THREADS",
    descKey: "SETTINGS.SMART_TASK.LLM_THREADS_DESC",
    fallback: 4,
  },
];

async function update<K extends keyof SmartTaskConfig>(
  key: K,
  value: SmartTaskConfig[K],
): Promise<void> {
  const ok = await updateSmartTaskValue(key, value);
  // 线程预算是主进程按配置推导的，写完要重新读一次才能显示新的生效值
  if (ok && (key === "onnxIntraOpThreads" || key === "llmMaxThreads")) {
    threadBudget.value = await getThreadBudget();
  }
}

/** 并发上限同时是 CPU 占用的主要放大器，改动后刷新一次生效值提示 */
async function onConcurrencyChange(value: number | null): Promise<void> {
  await update("semanticLinkConcurrency", value ?? DEFAULT_SMART_TASK_CONFIG.semanticLinkConcurrency);
}

function clampRerank(value: number | null): number {
  const next = value ?? DEFAULT_SMART_TASK_CONFIG.rerankTopK;
  return Math.min(Math.max(1, next), smartTask.value.annTopK);
}

/** 候选数调小到低于保留数时，一并压低保留数（rerankTopK ≤ annTopK 是执行器的硬约束） */
async function onAnnTopKChange(value: number | null): Promise<void> {
  const next = Math.min(
    Math.max(1, value ?? DEFAULT_SMART_TASK_CONFIG.annTopK),
    32,
  );
  await update("annTopK", next);
  if (smartTask.value.rerankTopK > next) {
    await update("rerankTopK", next);
  }
}

onMounted(async () => {
  threadBudget.value = await getThreadBudget();
});
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.smart-task-settings {
  max-height: 100%;
}

.setting-card {
  margin-bottom: $spacing-md;
  background-color: var(--bg-secondary);
  border-radius: $radius-md;
}

.setting-group {
  display: block;
  margin-bottom: $spacing-sm;
  font-size: $font-sm;
  color: var(--text-third);
}

.setting-row {
  margin-bottom: $spacing-md;
  align-items: center;
  min-height: 34px;
  justify-content: space-between !important;

  &:last-child {
    margin-bottom: 0;
  }
}

.setting-content {
  flex-direction: column !important;
  align-items: flex-start !important;
  gap: 0 !important;
  max-width: calc(100% - 200px);
}

.setting-label {
  font-size: $font-base;
}

.setting-desc {
  font-size: $font-xs;
  color: var(--text-third);
}

.setting-input {
  width: 110px;
  flex-shrink: 0;
}

.setting-switch {
  flex-shrink: 0;
}

.thread-control {
  flex-shrink: 0;
}

.thread-status {
  display: block;
  margin-top: $spacing-xs;
}
</style>
