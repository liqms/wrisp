<template>
  <NodeViewWrapper as="li" class="task-item-node">
    <!-- 勾选框：mousedown 阻止默认（防编辑器抢焦点，同官方 NodeView），
         change 统一处理鼠标与键盘（Space）两种切换路径 -->
    <label
      class="task-item-checkbox"
      contenteditable="false"
      :title="t('EDITOR.TASK_ITEM.TOGGLE_CHECKED_TITLE')"
      @mousedown.prevent
    >
      <input
        type="checkbox"
        :checked="props.node.attrs.checked"
        @change="onCheckboxChange"
      />
    </label>
    <div class="task-item-body">
      <!-- ProseMirror 内容区（contentDOM） -->
      <NodeViewContent as="div" class="task-item-text" />
      <!-- 日期药丸：复用 [[双链]] 的 inline-sem 视觉（括号弱化 + 药丸背景），
           点击复用日期斜杠命令的 pickDate 浮层（NDatePicker panel） -->
      <span
        v-if="date"
        class="task-item-date"
        contenteditable="false"
        :title="t('EDITOR.TASK_ITEM.CHANGE_DATE_TITLE')"
        @mousedown.stop.prevent
        @click.stop="openDatePicker"
      >
        <span class="inline-sem-symbol">[[</span>{{ date
        }}<span class="inline-sem-symbol">]]</span>
      </span>
      <!-- 无日期时的弱占位药丸（悬浮任务行显示），点击添加日期 -->
      <span
        v-else
        class="task-item-date task-item-date-placeholder"
        contenteditable="false"
        :title="t('EDITOR.TASK_ITEM.ADD_DATE_TITLE')"
        @mousedown.stop.prevent
        @click.stop="openDatePicker"
      >
        <span class="inline-sem-symbol">[[</span>{{ t("EDITOR.TASK_ITEM.DATE_LABEL")
        }}<span class="inline-sem-symbol">]]</span>
      </span>
    </div>
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from "@tiptap/vue-3";
import { i18n } from "@/renderer/plugins/i18n";
import { pickDate } from "../../slash/commands/datePicker";

// 与 datePicker.ts 相同的取译法（不依赖组件级 i18n 上下文，NodeView 挂载更稳）
const t = i18n.global.t as (key: string) => string;
const props = defineProps(nodeViewProps);

/** 日期属性（非法格式回退空串 → 不渲染药丸，显示占位） */
const date = computed(() => {
  const v = props.node.attrs.date;
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
});

/** 勾选框 change（鼠标点击 / 键盘 Space 均触发）：切换完成状态 */
function onCheckboxChange(e: Event): void {
  props.updateAttributes({ checked: (e.target as HTMLInputElement).checked });
}

/** 点击日期药丸 / 占位：复用斜杠命令的日期浮层，选中后写入属性（取消不动） */
async function openDatePicker(): Promise<void> {
  const pos = props.getPos();
  if (typeof pos !== "number") return;
  const value = await pickDate(props.editor, pos);
  if (value) props.updateAttributes({ date: value });
}
</script>
