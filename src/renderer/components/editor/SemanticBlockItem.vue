<template>
  <n-flex class="semantic-block" :class="{ 'is-editing': isEditing }">
    <!-- 查看模式 -->
    <template v-if="!isEditing">
      <div class="block-view markdown-content" v-html="renderedHTML"></div>
      <n-flex class="view-actions-wapper">
        <n-divider class="block-divider" />
        <n-flex class="block-actions">
          <n-button quaternary size="tiny" @click="enterEditMode" :title="$t('ACTION.COMMON.EDIT')">
            <template #icon>
              <n-icon>
                <Pencil />
              </n-icon>
            </template>
          </n-button>
          <n-button quaternary size="tiny" :loading="deleting" @click="handleDelete"
            :title="$t('ACTION.COMMON.DELETE')">
            <template #icon>
              <n-icon>
                <TrashBin />
              </n-icon>
            </template>
          </n-button>
        </n-flex>
      </n-flex>
    </template>

    <!-- 编辑模式 -->
    <template v-else>
      <TiptapEditor ref="editorRef" v-model:model-value="editContent" :min-height="60" :max-height="500"
        :slash-command="false" class="edit-editor" @enter="saveEdit" />
      <n-flex class="block-actions">
        <n-button quaternary size="tiny" type="primary" :loading="saving" @click="saveEdit"
          :title="$t('ACTION.COMMON.SAVE')">
          <template #icon>
            <n-icon>
              <Checkmark />
            </n-icon>
          </template>
        </n-button>
        <n-button quaternary size="tiny" @click="cancelEdit" :title="$t('ACTION.COMMON.CANCEL')">
          <template #icon>
            <n-icon>
              <Close />
            </n-icon>
          </template>
        </n-button>
      </n-flex>
    </template>
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { Pencil, TrashBin, Checkmark, Close } from "@vicons/ionicons5";
import TiptapEditor from "./TiptapEditor.vue";
import type { SemanticBlock } from "./SemanticGroup";
import { marked } from "marked";
import { useCapture } from "@/renderer/composables/useCapture";
import { useFrontendNotification } from "@/renderer/composables/useNotification";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const props = defineProps<{
  block: SemanticBlock;
}>();

const emit = defineEmits<{
  (e: "updated", blockId: string): void;
  (e: "deleted", blockId: string): void;
}>();

const notification = useFrontendNotification(
  { title: "", content: "" }
);

const { updateCapture, deleteCapture } = useCapture();

const isEditing = ref(false);
const saving = ref(false);
const deleting = ref(false);
const editContent = ref("");
const editorRef = ref<InstanceType<typeof TiptapEditor> | null>(null);

const renderedHTML = computed(() => {
  if (!props.block.content) return "";
  return marked.parse(props.block.content) as string;
});

const enterEditMode = () => {
  editContent.value = props.block.content;
  isEditing.value = true;
};

const cancelEdit = () => {
  editContent.value = props.block.content;
  isEditing.value = false;
};

const saveEdit = async () => {
  const md = editorRef.value?.getMarkdown();
  if (!md) return;
  saving.value = true;
  try {
    const success = await updateCapture({ id: props.block.id, content: md });
    if (success) {
      isEditing.value = false;
      emit("updated", props.block.id);
    } else {
      notification.error("更新失败", "请稍后再试");
    }
  } catch (err) {
    console.error("Save failed", err);
    notification.error("保存失败", "请稍后再试");
  } finally {
    saving.value = false;
  }
};

const handleDelete = async () => {
  if (!window.confirm("确认删除此内容？")) return;
  deleting.value = true;
  try {
    const success = await deleteCapture(props.block.id);
    if (success) {
      emit("deleted", props.block.id);
    } else {
      notification.error("删除失败", "请稍后再试");
    }
  } catch (err) {
    console.error("Delete failed", err);
    notification.error("删除失败", "请稍后再试");
  } finally {
    deleting.value = false;
  }
};

</script>

<style lang="scss" scoped>
@use "@/renderer/styles/_variables" as *;
@use "@/renderer/styles/_markdown" as *;

.semantic-block {
  position: relative;
  border-left: 2px solid transparent;
  // margin: $spacing-xs 0;
  padding: $spacing-sm;
  transition: all $transition-base;
  border-radius: $radius-md;
  display: block !important;

  &:hover {
    background: var(--bg-secondary);
  }

  &.is-editing {
    background-color: var(--bg-secondary);
    border-left-color: var(--color-primary);
    padding: $spacing-sm;
    border-radius: 0;
  }
}

.block-view {
  width: 100%;
}

/* 查看模式下的底部操作按钮：仅在悬浮时显示 */
.view-actions-wapper {
  margin-top: $spacing-md;
  height: 31px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.18s ease, visibility 0.18s ease;
}

.semantic-block:hover .view-actions-wapper {
  opacity: 1;
  visibility: visible;
}

/* 编辑模式下操作按钮（始终可见） */
.block-actions {
  padding: 0;
  // margin-top: $spacing-md;
}

.block-divider {
  margin: 0;
}

/* 保持兼容：其他场景的 block-actions 样式已包含上面 */

.edit-editor {
  padding: 0 $spacing-sm;
  width: 100%;

}
</style>
