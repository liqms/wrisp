<template>
  <div class="smart-task-panel">
    <n-flex align="center" justify="space-between" class="panel-header">
      <n-text class="overall-text">{{ statusText }}</n-text>
      <n-text depth="3" class="overall-percent">{{ percent }}%</n-text>
    </n-flex>
    <n-progress class="overall-progress" type="line" :percentage="percent" :show-indicator="false" :height="4"
      color="var(--primary-color)" />

    <n-list class="step-list">
      <n-list-item v-for="step in steps" :key="step.id" class="step-item">
        <n-flex vertical class="step-body">
          <n-flex align="center" :size="6">
            <span class="state-dot" :class="`state-${step.state}`" />
            <n-text class="step-label">{{ stepLabel(step) }}</n-text>
            <n-text class="step-state" :class="`state-${step.state}`" depth="3">
              {{ stateText(step.state) }}
            </n-text>
          </n-flex>
          <n-text v-if="summary(step)" depth="3" class="step-summary">{{ summary(step) }}</n-text>
          <n-text v-if="reasonText(step)" depth="3" class="step-reason">{{ reasonText(step) }}</n-text>
        </n-flex>
      </n-list-item>
    </n-list>

    <n-flex v-if="steps.length === 0" class="empty" align="center" justify="center">
      <n-text depth="3" class="empty-text">{{ t('SMART_TASK.STATUS_PENDING') }}</n-text>
    </n-flex>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { NList, NListItem, NFlex, NText, NProgress } from "naive-ui";
import { useSmartTaskStore } from "@/renderer/store/smart-task.store";
import type { SmartTaskStep, SmartTaskStepState } from "@/shared/types";

const { t } = useI18n();
const store = useSmartTaskStore();

const steps = computed(() => store.steps);
const percent = computed(() => store.percent);
const isRunning = computed(() => store.isRunning);

const statusText = computed(() =>
  isRunning.value
    ? (t("SMART_TASK.IN_PROGRESS", { percent: percent.value }) as string)
    : (t("SMART_TASK.FINISHED") as string),
);

/** 任务名 → 文案 key */
const TASK_LABEL_KEYS: Record<string, string> = {
  "chunk-summary": "SMART_TASK.TASK_CHUNK_SUMMARY",
  "chunk-vectorize": "SMART_TASK.TASK_CHUNK_VECTORIZE",
  "semantic-link": "SMART_TASK.TASK_SEMANTIC_LINK",
  "concept-extract": "SMART_TASK.TASK_CONCEPT_EXTRACT",
  "topic-detection": "SMART_TASK.TASK_TOPIC_DETECTION",
  "topic-summary": "SMART_TASK.TASK_TOPIC_SUMMARY",
};

/** family → 文案 key */
const FAMILY_LABEL_KEYS: Record<string, string> = {
  llm: "SMART_TASK.FAMILY_LLM",
  embedding: "SMART_TASK.FAMILY_EMBEDDING",
  reranker: "SMART_TASK.FAMILY_RERANKER",
};

const STATE_KEYS: Record<SmartTaskStepState, string> = {
  pending: "SMART_TASK.STATUS_PENDING",
  running: "SMART_TASK.STATUS_RUNNING",
  success: "SMART_TASK.STATUS_SUCCESS",
  failed: "SMART_TASK.STATUS_FAILED",
  skipped: "SMART_TASK.STATUS_SKIPPED",
};

/** 跳过 / 复用原因码 → 文案 key */
const REASON_KEYS: Record<string, string> = {
  reused: "SMART_TASK.REASON_REUSED",
  busy: "SMART_TASK.REASON_BUSY",
  keepalive: "SMART_TASK.REASON_KEEPALIVE",
  "no-model": "SMART_TASK.REASON_NO_MODEL",
};

function familyLabel(family?: string): string {
  if (!family) return "";
  const key = FAMILY_LABEL_KEYS[family];
  return key ? (t(key) as string) : family;
}

function stepLabel(step: SmartTaskStep): string {
  switch (step.kind) {
    case "prepare":
      return t("SMART_TASK.STEP_PREPARE") as string;
    case "done":
      return t("SMART_TASK.STEP_DONE") as string;
    case "model-load":
      return t("SMART_TASK.STEP_MODEL_LOAD", { family: familyLabel(step.family) }) as string;
    case "model-release":
      return t("SMART_TASK.STEP_MODEL_RELEASE", { family: familyLabel(step.family) }) as string;
    case "task": {
      const key = TASK_LABEL_KEYS[step.ref];
      return key ? (t(key) as string) : step.ref;
    }
    default:
      return step.ref;
  }
}

function stateText(state: SmartTaskStepState): string {
  return t(STATE_KEYS[state]) as string;
}

function formatGB(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)}GB`;
}

/** 步骤概要信息：模型节点显示 CPU / 内存，任务节点显示数据量 */
function summary(step: SmartTaskStep): string {
  if (step.kind === "model-load" || step.kind === "model-release") {
    const parts: string[] = [];
    if (typeof step.cpuUsage === "number") {
      parts.push(t("SMART_TASK.CPU", { percent: step.cpuUsage }) as string);
    }
    if (typeof step.memoryUsed === "number" && typeof step.memoryTotal === "number") {
      parts.push(
        t("SMART_TASK.MEMORY", {
          used: formatGB(step.memoryUsed),
          total: formatGB(step.memoryTotal),
          percent: step.memoryPercent ?? 0,
        }) as string,
      );
    }
    if (step.modelId) parts.push(step.modelId);
    return parts.join(" · ");
  }

  if (step.kind === "task") {
    const parts: string[] = [];
    if (typeof step.dataAmount === "number") {
      parts.push(t("SMART_TASK.DATA_AMOUNT", { count: step.dataAmount }) as string);
    }
    if (typeof step.processedCount === "number") {
      parts.push(t("SMART_TASK.PROCESSED", { count: step.processedCount }) as string);
    }
    return parts.join(" · ");
  }

  return "";
}

function reasonText(step: SmartTaskStep): string {
  if (!step.reason) return "";
  const key = REASON_KEYS[step.reason];
  return key ? (t(key) as string) : step.reason;
}
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.smart-task-panel {
  width: 100%;
}

.panel-header {
  margin-bottom: $spacing-xs;
}

.overall-text {
  font-size: $font-sm;
  font-weight: $font-medium;
}

.overall-percent {
  font-size: $font-sm;
}

.overall-progress {
  margin-bottom: $spacing-sm;
}

.step-list {
  max-height: 420px;
  overflow-y: auto;
}

.step-item {
  padding: $spacing-xs 0;
}

.step-body {
  gap: 2px !important;
  width: 100%;
}

.step-label {
  font-size: $font-xs;
}

.step-state {
  font-size: $font-xs;
  margin-left: auto;
}

.step-summary {
  font-size: $font-xs;
}

.step-reason {
  font-size: $font-xs;
}

.state-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.state-pending {
  color: var(--text-quaternary);
}

.state-dot.state-pending {
  background-color: var(--text-quaternary);
}

.state-running {
  color: var(--primary-color);
}

.state-dot.state-running {
  background-color: var(--primary-color);
}

.state-success {
  color: var(--success-color);
}

.state-dot.state-success {
  background-color: var(--success-color);
}

.state-failed {
  color: var(--error-color);
}

.state-dot.state-failed {
  background-color: var(--error-color);
}

.state-skipped {
  color: var(--text-quaternary);
}

.state-dot.state-skipped {
  background-color: var(--text-quaternary);
  opacity: 0.6;
}

.empty {
  padding: $spacing-md 0;
}

.empty-text {
  font-size: $font-xs;
}
</style>