<template>
  <NodeViewWrapper class="metric-card-wrap" :class="{ selected }">
    <div class="metric-card" :data-trend="trendDir" @dblclick="openEdit">
      <span class="metric-card__actions">
        <span class="metric-card__action" :title="t('EDITOR.BLOCKS.METRIC.EDIT_HINT')"
          @click.stop="openEdit">
          <n-icon :component="EditFilled" :size="14" />
        </span>
        <span class="metric-card__action" :title="t('ACTION.COMMON.DELETE')" @click.stop="deleteCard">
          <n-icon :component="DeleteFilled" :size="14" />
        </span>
      </span>
      <div class="metric-card__label" :class="{ 'is-empty': !label }">
        {{ label || t("EDITOR.BLOCKS.METRIC.EMPTY_HINT") }}
      </div>
      <n-flex class="metric-card__value-row" align="center" :size="4">
        <span class="metric-card__value" :class="{ 'is-empty': !value }">
          {{ value || "--" }}
        </span>
        <span v-if="unit" class="metric-card__unit">{{ unit }}</span>
      </n-flex>
      <n-flex v-if="trend" class="metric-card__trend" align="center" :size="0">
        <n-icon :component="trendIcon" :size="18" />
        <span>{{ trend }}</span>
      </n-flex>
    </div>
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { NodeViewWrapper, nodeViewProps } from "@tiptap/vue-3";
import {
  ArrowDropDownFilled,
  ArrowDropUpFilled,
  TrendingFlatFilled,
  EditFilled,
  DeleteFilled,
} from "@vicons/material";
import { openBlockEditor } from "./bus";

const props = defineProps(nodeViewProps);

const { t } = useI18n();

const label = computed(() => String(props.node?.attrs.label ?? ""));
const value = computed(() => String(props.node?.attrs.value ?? ""));
const unit = computed(() => String(props.node?.attrs.unit ?? ""));
const trend = computed(() => String(props.node?.attrs.trend ?? ""));
const trendDir = computed(() => String(props.node?.attrs.trendDir ?? "up"));

const trendIcon = computed(() => {
  if (trendDir.value === "down") return ArrowDropDownFilled;
  if (trendDir.value === "flat") return TrendingFlatFilled;
  return ArrowDropUpFilled;
});

function openEdit(): void {
  const pos = props.getPos?.();
  if (typeof pos !== "number" || !props.editor) return;
  openBlockEditor({
    editor: props.editor,
    pos,
    nodeType: "metric",
    attrs: { ...(props.node?.attrs ?? {}) },
  });
}

function deleteCard(): void {
  props.deleteNode?.();
}
</script>

<style lang="scss" scoped>
.metric-card-wrap {
  display: inline-flex;
  vertical-align: top;
}

.metric-card {
  position: relative;
  flex: 1;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  cursor: default;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:hover {
    border-color: var(--primary-color);

    .metric-card__actions {
      opacity: 1;
    }
  }
}

.metric-card-wrap.selected .metric-card {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 1px var(--primary-color);
}

.metric-card__actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: inline-flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s;
}

.metric-card__action {
  display: inline-flex;
  padding: 2px;
  border-radius: 4px;
  color: var(--text-color);
  cursor: pointer;
  transition: color 0.2s;

  &:hover {
    color: var(--primary-color);
  }
}

.metric-card__label {
  font-size: 12px;
  color: rgba(128, 128, 128, 0.9);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.is-empty {
    color: rgba(128, 128, 128, 0.5);
  }
}

.metric-card__value-row {
  margin-top: 4px;
}

.metric-card__value {
  font-size: 22px;
  font-weight: 600;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.is-empty {
    color: rgba(128, 128, 128, 0.4);
  }
}

.metric-card__unit {
  font-size: 13px;
  color: rgba(128, 128, 128, 0.9);
}

.metric-card__trend {
  margin-top: 2px;
  font-size: 13px;

  :deep(span) {
    line-height: 1;
  }
}

.metric-card[data-trend="up"] .metric-card__trend {
  color: #e0544f;
}

.metric-card[data-trend="down"] .metric-card__trend {
  color: #2f9e6e;
}

.metric-card[data-trend="flat"] .metric-card__trend {
  color: rgba(128, 128, 128, 0.9);
}
</style>
