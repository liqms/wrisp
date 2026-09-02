<template>
  <n-modal :show="visible" preset="card" class="block-edit-modal" :style="{ width: '420px' }"
    :title="title" :mask-closable="false" @update:show="onVisibleChange">
    <n-form v-if="definition" ref="formRef" :model="formModel" :rules="formRules" label-placement="left"
      label-width="auto" require-mark-placement="left">
      <n-form-item v-for="field in definition.fields" :key="field.key" :label="t(field.labelKey)"
        :path="field.key">
        <n-select v-if="field.type === 'enum'" v-model:value="formModel[field.key]"
          :options="enumOptions(field)" />
        <n-input v-else v-model:value="formModel[field.key]" :maxlength="field.maxLength"
          :placeholder="t('EDITOR.BLOCKS.COMMON.INPUT_PLACEHOLDER')" clearable
          @keydown.enter.prevent />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-flex justify="end" :size="12">
        <n-button size="small" @click="onVisibleChange(false)">
          {{ t("ACTION.COMMON.CANCEL") }}
        </n-button>
        <n-button size="small" type="primary" @click="onSave">
          {{ t("ACTION.COMMON.CONFIRM") }}
        </n-button>
      </n-flex>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { FormInst, FormRules } from "naive-ui";
import { findBlockByType } from "../registry";
import type { WrispBlockField } from "../registry";
import { sanitizeAttrs } from "../engine/md-codec";

const props = defineProps<{
  visible: boolean;
  /** 卡片节点类型名（宿主由编辑请求解析） */
  nodeType: string;
  /** 编辑前 attrs 快照（表单初始值） */
  attrs: Record<string, string | number | boolean>;
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
  save: [attrs: Record<string, string>];
}>();

const { t } = useI18n();

const formRef = ref<FormInst | null>(null);

/** 当前块定义（字段 schema 驱动表单） */
const definition = computed(() => findBlockByType(props.nodeType));

const title = computed(() =>
  definition.value ? t(definition.value.titleKey) : "",
);

/** 表单模型：字段 schema 初始化（未提供值回落默认值） */
const formModel = ref<Record<string, string>>({});

watch(
  () => props.visible,
  (visible) => {
    if (!visible || !definition.value) return;
    const model: Record<string, string> = {};
    for (const field of definition.value.fields) {
      const raw = props.attrs[field.key];
      model[field.key] = typeof raw === "string" ? raw : String(field.default);
    }
    formModel.value = model;
  },
  { immediate: true },
);

/** 枚举字段选项（受控词表，翻译显示） */
function enumOptions(field: WrispBlockField) {
  return (field.enumValues ?? []).map((item) => ({
    label: t(item.labelKey),
    value: item.value,
  }));
}

/** 校验规则：required → 必填；text + pattern → 格式受限 */
const formRules = computed<FormRules>(() => {
  const rules: FormRules = {};
  for (const field of definition.value?.fields ?? []) {
    if (field.required) {
      rules[field.key] = {
        required: true,
        trigger: ["blur", "input"],
        message: t("EDITOR.BLOCKS.COMMON.REQUIRED"),
      };
    } else if (field.pattern) {
      rules[field.key] = {
        trigger: ["blur", "input"],
        validator: (_rule: unknown, value: string) => {
          if (!value) return true;
          return field.pattern?.test(value)
            ? true
            : new Error(t("EDITOR.BLOCKS.COMMON.FORMAT_INVALID"));
        },
      };
    }
  }
  return rules;
});

function onVisibleChange(value: boolean): void {
  emit("update:visible", value);
}

function onSave(): void {
  const def = definition.value;
  if (!def) return;
  formRef.value?.validate((errors) => {
    if (errors) return;
    // 统一走 schema 校验（枚举/格式/长度回退），保证落盘字段可靠
    emit("save", sanitizeAttrs(formModel.value, def.fields));
    onVisibleChange(false);
  });
}
</script>
