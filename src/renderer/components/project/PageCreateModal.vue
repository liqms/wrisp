<template>
  <n-modal :show="show" preset="card" :title="t('TIPS.PAGE.CREATE_TITLE')" style="width: 520px" :mask-closable="false"
    @update:show="handleUpdateShow">
    <n-form ref="formRef" :model="formData" :rules="formRules" label-placement="top">
      <n-form-item :label="t('TIPS.PAGE.PAGE_TITLE')" path="title">
        <n-input v-model:value="formData.title" :placeholder="t('TIPS.PAGE.INPUT_PAGE_TITLE')"
          @input="titleTouched = true" />
      </n-form-item>
      <n-form-item :label="t('TIPS.PAGE.SELECT_TEMPLATE')">
        <div class="template-list">
          <button type="button" class="template-item" :class="{ 'is-selected': selectedTemplateId === '' }"
            @click="selectTemplate('')">
            <div class="template-item-icon">
              <n-icon size="20">
                <Add />
              </n-icon>
            </div>
            <div class="template-item-info">
              <div class="template-item-title">{{ t("TIPS.PAGE.NO_TEMPLATE") }}</div>
              <div class="template-item-desc">{{ t("TIPS.PAGE.NO_TEMPLATE_DESC") }}</div>
            </div>
          </button>
          <button v-for="tpl in templateOptions" :key="tpl.id" type="button" class="template-item"
            :class="{ 'is-selected': selectedTemplateId === tpl.id }" @click="selectTemplate(tpl.id)">
            <div class="template-item-icon">
              <component :is="resolveTemplateIcon(tpl.icon)" class="template-item-svg" />
            </div>
            <div class="template-item-info">
              <div class="template-item-title">{{ tpl.title }}</div>
              <div class="template-item-desc">{{ tpl.description }}</div>
            </div>
          </button>
        </div>
      </n-form-item>
    </n-form>
    <template #footer>
      <n-flex justify="flex-end" :gap="12">
        <n-button @click="handleUpdateShow(false)">{{ t("ACTION.COMMON.CANCEL") }}</n-button>
        <n-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ t("ACTION.COMMON.CREATE") }}
        </n-button>
      </n-flex>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useMessage } from "naive-ui";
import type { FormInst, FormRules } from "naive-ui";
import { Add } from "@vicons/ionicons5";
import { PAGE_TYPE } from "@/shared/enums";
import { TEMPLATE_TYPE } from "@/shared/enums/template.enums";
import { useConfig } from "@/renderer/composables/useConfig";
import { usePage } from "@/renderer/composables/usePage";
import { useTemplateStore } from "@/renderer/store/template.store";
import { resolveTemplateIcon } from "@/renderer/components/editor/slash/commands/template-icons";

const props = defineProps<{
  show: boolean;
  projectId: string;
  /** 新页面的父页面；null 表示根级页面 */
  parentId: string | null;
}>();

const emit = defineEmits<{
  (e: "update:show", show: boolean): void;
  (e: "created", pageId: string): void;
}>();

const { t } = useI18n();
const message = useMessage();
const { locale } = useConfig();
const { createPage } = usePage();
const templateStore = useTemplateStore();

const submitting = ref(false);
const formRef = ref<FormInst | null>(null);
const formData = ref({ title: "" });
/** 用户是否手动修改过标题（未修改时选模板可自动填充模板标题） */
const titleTouched = ref(false);
const selectedTemplateId = ref("");

const formRules: FormRules = {
  title: [
    { required: true, message: t("TIPS.PAGE.INPUT_PAGE_TITLE"), trigger: "blur" },
  ],
};

// 打开弹窗时：确保页面模板已加载并重置表单
watch(
  () => props.show,
  (visible) => {
    if (!visible) return;
    if (!templateStore.isLoaded(TEMPLATE_TYPE.PAGE)) {
      templateStore.fetch(TEMPLATE_TYPE.PAGE);
    }
    formData.value.title = "";
    titleTouched.value = false;
    selectedTemplateId.value = "";
  },
);

/** 可选的页面模板（仅启用的；不区分职业，文档模板对所有职业通用） */
const templateOptions = computed(() =>
  templateStore
    .allTemplates(TEMPLATE_TYPE.PAGE, locale.value)
    .filter((tpl) => tpl.enabled),
);

function selectTemplate(id: string) {
  selectedTemplateId.value = id;
  // 用户未手动输入标题时，选中模板自动填充模板标题
  if (!titleTouched.value) {
    const tpl = templateOptions.value.find((item) => item.id === id);
    formData.value.title = tpl?.title ?? "";
  }
}

const handleUpdateShow = (value: boolean) => emit("update:show", value);

async function handleSubmit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  const tpl = templateOptions.value.find(
    (item) => item.id === selectedTemplateId.value,
  );
  submitting.value = true;
  try {
    const id = await createPage({
      projectId: props.projectId,
      parentId: props.parentId,
      pageType: PAGE_TYPE.PROJECT_CHAPTER,
      title: formData.value.title.trim(),
      // 选中模板时以模板 Markdown 作为初始内容；否则创建空白页面
      content: tpl?.markdown ?? "",
    });
    if (id) {
      message.success(t("NOTIFICATION.SUCCESS"));
      emit("update:show", false);
      emit("created", id);
    } else {
      message.error(t("ERROR.PAGE.CREATE_FAILED"));
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped lang="scss">
@use "@/renderer/styles/_variables" as *;

.template-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $spacing-sm;
  width: 100%;
  overflow-y: auto;
}

.template-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-sm;
  min-width: 0;
  padding: 14px 10px;
  text-align: center;
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: $radius-md;
  background: transparent;
  cursor: pointer;
  transition: all $transition-fast ease;

  &:hover {
    border-color: var(--primary-color);
  }

  &.is-selected {
    border-color: var(--primary-color);
    background: color-mix(in srgb, var(--primary-color) 10%, transparent);
  }
}

.template-item-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $radius-md;
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.template-item-svg {
  width: 20px;
  height: 20px;
}

.template-item-info {
  width: 100%;
  min-width: 0;
}

.template-item-title {
  font-size: 13px;
  font-weight: $font-medium;
  color: var(--text-color);
  line-height: 1.4;
}

.template-item-desc {
  font-size: $font-xs;
  color: var(--text-third);
  line-height: 1.3;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
