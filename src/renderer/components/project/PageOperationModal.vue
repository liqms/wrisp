<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { PageTree } from "@/main/types/db";

const props = withDefaults(
  defineProps<{
    show: boolean;
    page: PageTree | null;
    treeNodes?: PageTree[];
    /** 用于 move 后刷新，仅声明透传 */
    projectId?: string;
  }>(),
  { treeNodes: () => [], projectId: "" },
);

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "moved", pageId: string, parentId: string | null): void;
  (e: "deleted", pageId: string): void;
}>();

const { t } = useI18n();

const ROOT = "__ROOT__";
const targetParent = ref<string>(ROOT);

/** 排除自身及所有后代的 id */
function collectExcluded(node: PageTree, acc: string[]): string[] {
  acc.push(node.id);
  for (const child of node.children ?? []) collectExcluded(child, acc);
  return acc;
}

/** 展开为 { label, value, disabled } 列表 */
function flatten(
  nodes: PageTree[],
  excluded: Set<string>,
  depth = 0,
): { label: string; value: string; disabled: boolean }[] {
  const result: { label: string; value: string; disabled: boolean }[] = [];
  for (const node of nodes) {
    const disabled = excluded.has(node.id);
    result.push({
      label: `${"　".repeat(depth)}${node.title}`,
      value: node.id,
      disabled,
    });
    result.push(...flatten(node.children ?? [], excluded, depth + 1));
  }
  return result;
}

const moveOptions = computed(() => {
  if (!props.page) return [];
  const excluded = new Set(collectExcluded(props.page, []));
  return [
    { label: t("APP.BASE.ROOT"), value: ROOT, disabled: false },
    ...flatten(props.treeNodes, excluded),
  ];
});

const selectOptions = computed(() => ({
  options: moveOptions.value,
  value: targetParent.value,
  onUpdateValue: (v: string) => (targetParent.value = v),
}));

watch(
  () => props.show,
  (visible) => {
    if (visible) targetParent.value = ROOT;
  },
);

function handleMove() {
  if (!props.page) return;
  emit(
    "moved",
    props.page.id,
    targetParent.value === ROOT ? null : targetParent.value,
  );
}

function handleDelete() {
  if (!props.page) return;
  emit("deleted", props.page.id);
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    :title="page?.title ?? t('APP.BASE.MORE')"
    style="width: 420px"
    @update:show="emit('update:show', $event)"
  >
    <n-flex vertical size="large">
      <!-- 移动到 -->
      <n-form-item :label="t('APP.BASE.MOVE_TO')">
        <n-select v-bind="selectOptions" filterable clearable />
      </n-form-item>
      <!-- 删除 -->
      <n-popconfirm
        :positive-text="t('ACTION.COMMON.DELETE')"
        :negative-text="t('ACTION.COMMON.CANCEL')"
        @positive-click="handleDelete"
      >
        <template #trigger>
          <n-button type="error" block>{{
            t("ACTION.COMMON.DELETE")
          }}</n-button>
        </template>
        {{ t("TIPS.PAGE.CONFIRM_DELETE") }}
      </n-popconfirm>
    </n-flex>
    <template #footer>
      <n-space justify="end">
        <n-button @click="emit('update:show', false)">{{
          t("ACTION.COMMON.CANCEL")
        }}</n-button>
        <n-button type="primary" @click="handleMove">{{
          t("ACTION.COMMON.CONFIRM")
        }}</n-button>
      </n-space>
    </template>
  </n-modal>
</template>
