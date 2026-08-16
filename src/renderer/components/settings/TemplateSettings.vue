<template>
  <n-flex vertical size="large">
    <n-flex justify="space-between" align="center">
      <div>
        <div class="title">{{ t("SETTINGS.TEMPLATE_SETTINGS.TITLE") }}</div>
        <div class="desc">{{ t("SETTINGS.TEMPLATE_SETTINGS.DESC") }}</div>
      </div>
      <n-button type="primary" @click="openCreate">
        {{ t("SETTINGS.TEMPLATE_SETTINGS.ADD") }}
      </n-button>
    </n-flex>

    <n-flex align="center" :size="8">
      <n-button size="small" :type="filterProfession === '' ? 'primary' : 'default'" @click="filterProfession = ''">
        {{ t("SETTINGS.TEMPLATE_SETTINGS.ALL") }}
      </n-button>
      <n-button v-for="opt in professionOptions" :key="opt.value" size="small"
        :type="filterProfession === opt.value ? 'primary' : 'default'" @click="filterProfession = opt.value">
        {{ opt.label }}
      </n-button>
    </n-flex>

    <n-data-table :columns="columns" :data="filteredTemplates" :bordered="false"
      :row-key="(row: SlashTemplateItem) => row.id" :max-height="tableMaxHeight" />
  </n-flex>

  <TemplateEditModal v-model:show="editVisible" :template="editingTemplate" @save="onSave" />
</template>

<script setup lang="ts">
import { ref, computed, h } from "vue";
import { useI18n } from "vue-i18n";
import { NButton, NSwitch, useMessage } from "naive-ui";
import type { DataTableColumns } from "naive-ui";
import { PROFESSION, type Profession } from "@/shared/enums";
import type { AppConfig } from "@/shared/types";
import { useConfig } from "@/renderer/composables/useConfig";
import { useTemplateStore } from "@/renderer/store/template.store";
import type {
  CustomTemplate,
  SlashTemplateItem,
} from "@/shared/types/template.types";
import TemplateEditModal from "./TemplateEditModal.vue";

// 设置页通过 SettingsView 统一传入 config（本组件使用 store 读取配置，此处声明以接收该 prop）
defineProps<{ config?: AppConfig | null }>();

const { t } = useI18n();
const message = useMessage();
const { locale } = useConfig();
const store = useTemplateStore();

// 确保进入设置时已加载模板文件
if (!store.loaded) store.fetch();

const filterProfession = ref<Profession | "">("");

const professionOptions = (Object.values(PROFESSION) as Profession[]).map(
  (value) => ({
    label: t(`SETTINGS.PROFESSION.OPTION_${value.toUpperCase()}`),
    value,
  }),
);

const allTemplates = computed<SlashTemplateItem[]>(() =>
  store.allTemplates(locale.value),
);

const filteredTemplates = computed<SlashTemplateItem[]>(() => {
  const list = allTemplates.value;
  if (!filterProfession.value) return list;
  return list.filter((item) => item.profession === filterProfession.value);
});

// 仅让表格内部滚动（表头固定），避免整个设置页滚动
const tableMaxHeight = computed(() => "calc(60vh - 150px)");

const editVisible = ref(false);
const editingTemplate = ref<CustomTemplate | null>(null);

function openCreate() {
  editingTemplate.value = null;
  editVisible.value = true;
}

function openEdit(row: SlashTemplateItem) {
  editingTemplate.value = {
    id: row.id,
    title: row.title,
    description: row.description,
    icon: row.icon,
    markdown: row.markdown,
    profession: row.profession,
    enabled: row.enabled,
  };
  editVisible.value = true;
}

async function onSave(tpl: CustomTemplate) {
  const ok = await store.saveCustom(tpl);
  if (ok) message.success(t("SETTINGS.TEMPLATE_SETTINGS.SAVED"));
  else message.error(t("ERROR.TEMPLATE.SAVE_FAILED"));
}

async function onDelete(row: SlashTemplateItem) {
  // 仅「自定义」职业的模板有删除入口，直接移除自定义模板
  const ok = await store.removeCustom(row.id);
  if (ok) message.success(t("SETTINGS.TEMPLATE_SETTINGS.DELETED"));
  else message.error(t("ERROR.TEMPLATE.DELETE_FAILED"));
}

async function onToggle(row: SlashTemplateItem, enabled: boolean) {
  const ok = await store.setEnabled(row.id, row.builtIn, enabled);
  if (!ok) message.error(t("ERROR.TEMPLATE.SAVE_FAILED"));
}

const columns: DataTableColumns<SlashTemplateItem> = [
  {
    title: t("SETTINGS.TEMPLATE_SETTINGS.NAME"),
    key: "title",
    render: (row) => row.title,
  },
  {
    title: t("SETTINGS.TEMPLATE_SETTINGS.PROFESSION"),
    key: "profession",
    width: 110,
    render: (row) => t(`SETTINGS.PROFESSION.OPTION_${row.profession.toUpperCase()}`),
  },
  {
    title: t("SETTINGS.TEMPLATE_SETTINGS.TYPE"),
    key: "builtIn",
    width: 90,
    render: (row) =>
      row.builtIn
        ? t("SETTINGS.TEMPLATE_SETTINGS.BUILT_IN")
        : t("SETTINGS.TEMPLATE_SETTINGS.CUSTOM"),
  },
  {
    title: t("SETTINGS.TEMPLATE_SETTINGS.ENABLED"),
    key: "enabled",
    width: 80,
    render: (row) =>
      h(NSwitch, {
        value: row.enabled,
        onUpdateValue: (v: boolean) => onToggle(row, v),
      }),
  },
  {
    title: t("SETTINGS.TEMPLATE_SETTINGS.ACTIONS"),
    key: "actions",
    width: 140,
    render: (row) =>
      row.profession === PROFESSION.CUSTOM
        ? [
          h(
            NButton,
            { size: "small", quaternary: true, onClick: () => openEdit(row) },
            { default: () => t("SETTINGS.TEMPLATE_SETTINGS.EDIT") },
          ),
          h(
            NButton,
            {
              size: "small",
              quaternary: true,
              type: "error",
              onClick: () => onDelete(row),
            },
            { default: () => t("SETTINGS.TEMPLATE_SETTINGS.DELETE") },
          ),
        ]
        : null,
  },
];
</script>

<style scoped lang="scss">
.title {
  font-size: 16px;
  font-weight: 600;
}

.desc {
  font-size: 12px;
  color: var(--text-color-3);
  margin-top: 4px;
}
</style>
