<template>
  <n-modal v-model:show="show" preset="card" :title="template
    ? t('SETTINGS.TEMPLATE_SETTINGS.EDIT')
    : t('SETTINGS.TEMPLATE_SETTINGS.ADD')
    " :style="{ maxWidth: '640px', width: 'calc(100% - 60px)' }" :mask-closable="false">
    <n-form label-placement="left" label-width="90">
      <n-form-item :label="t('SETTINGS.TEMPLATE_SETTINGS.NAME')" required>
        <n-input v-model:value="form.title" />
      </n-form-item>
      <n-form-item :label="t('SETTINGS.TEMPLATE_SETTINGS.DESCRIPTION')">
        <n-input v-model:value="form.description" />
      </n-form-item>
      <n-form-item :label="t('SETTINGS.TEMPLATE_SETTINGS.ICON')">
        <div class="template-icon-picker">
          <button v-for="name in TEMPLATE_ICON_NAMES" :key="name" type="button" class="template-icon-btn"
            :class="{ 'is-selected': form.icon === name }" :title="name" @click="form.icon = name">
            <component :is="TEMPLATE_ICONS[name]" class="template-icon-svg" />
          </button>
        </div>
      </n-form-item>
      <n-form-item :label="t('SETTINGS.TEMPLATE_SETTINGS.MARKDOWN')" required>
        <n-input v-model:value="form.markdown" type="textarea" :rows="6" placeholder="## 标题&#10;- 内容" />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="show = false">{{
          t("SETTINGS.TEMPLATE_SETTINGS.CANCEL")
        }}</n-button>
        <n-button type="primary" :disabled="!form.title || !form.markdown" @click="submit">
          {{ t("SETTINGS.TEMPLATE_SETTINGS.SAVE") }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { reactive, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { PROFESSION } from "@/shared/enums";
import {
  DEFAULT_TEMPLATE_ICON,
  isTemplateIconName,
} from "@/shared/enums/template.enums";
import {
  TEMPLATE_ICONS,
  TEMPLATE_ICON_NAMES,
} from "@/renderer/components/editor/slash/commands/template-icons";
import type { CustomTemplate } from "@/shared/types/template.types";
import { generateId } from "@/shared/utils/id";

const props = defineProps<{
  show: boolean;
  /** 编辑时传入已有模板；新增时传 null */
  template: CustomTemplate | null;
}>();

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "save", tpl: CustomTemplate): void;
}>();

const { t } = useI18n();

const show = computed({
  get: () => props.show,
  set: (value) => emit("update:show", value),
});

const form = reactive({
  title: "",
  description: "",
  icon: DEFAULT_TEMPLATE_ICON,
  profession: PROFESSION.CUSTOM,
  markdown: "",
});

function resetForm() {
  const base = props.template;
  form.title = base?.title ?? "";
  form.description = base?.description ?? "";
  form.icon = isTemplateIconName(base?.icon) ? base.icon : DEFAULT_TEMPLATE_ICON;
  // 自定义模板职业固定为「自定义」，不可选择
  form.profession = PROFESSION.CUSTOM;
  form.markdown = base?.markdown ?? "";
}

// 打开弹窗时（编辑/新增）用当前 template 回填表单，保证编辑有回显
watch(show, (visible) => {
  if (visible) resetForm();
});

function submit() {
  const tpl: CustomTemplate = {
    id: props.template?.id ?? `custom_${generateId()}`,
    title: form.title.trim(),
    description: form.description.trim(),
    icon: isTemplateIconName(form.icon) ? form.icon : DEFAULT_TEMPLATE_ICON,
    profession: form.profession,
    markdown: form.markdown,
    enabled: props.template?.enabled ?? true,
  };
  emit("save", tpl);
  show.value = false;
}
</script>

<style scoped>
.template-icon-picker {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  gap: 6px;
  width: 100%;
  max-height: 100px;
  overflow-y: auto;
  padding: 4px;
}

.template-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.template-icon-btn:hover {
  border-color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 10%, transparent);
}

.template-icon-btn.is-selected {
  border-color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 18%, transparent);
  box-shadow: 0 0 0 1px var(--primary-color);
}

.template-icon-svg {
  width: 22px;
  height: 22px;
}
</style>
