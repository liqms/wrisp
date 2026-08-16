import { ref } from "vue";
import { defineStore } from "pinia";
import type {
  CustomTemplate,
  SlashTemplateFile,
  SlashTemplateItem,
} from "@/shared/types/template.types";
import { builtinTemplates } from "@/renderer/components/editor/slash/commands/templates";
import { mergeTemplates } from "@/renderer/components/editor/slash/commands/template-merge";

export const useTemplateStore = defineStore("template", () => {
  const file = ref<SlashTemplateFile | null>(null);
  const loading = ref(false);
  /** 是否已从主进程成功加载过（避免重复拉取） */
  const loaded = ref(false);

  async function fetch(): Promise<void> {
    if (loading.value) return;
    loading.value = true;
    try {
      const res = await window.electronAPI.template.getFile();
      if (res.success && res.data) {
        file.value = res.data;
        loaded.value = true;
      }
    } finally {
      loading.value = false;
    }
  }

  /** 新增或更新自定义模板，成功后同步本地 file */
  async function saveCustom(tpl: CustomTemplate): Promise<boolean> {
    const res = await window.electronAPI.template.upsertCustom(tpl);
    if (res.success && res.data) {
      file.value = res.data;
      return true;
    }
    return false;
  }

  /** 删除自定义模板 */
  async function removeCustom(id: string): Promise<boolean> {
    const res = await window.electronAPI.template.deleteCustom(id);
    if (res.success && res.data) {
      file.value = res.data;
      return true;
    }
    return false;
  }

  /** 设置启用状态（内置 builtIn=true 走黑名单；自定义 false 走 enabled 字段） */
  async function setEnabled(
    id: string,
    builtIn: boolean,
    enabled: boolean,
  ): Promise<boolean> {
    const res = await window.electronAPI.template.setEnabled(
      id,
      builtIn,
      enabled,
    );
    if (res.success && res.data) {
      file.value = res.data;
      return true;
    }
    return false;
  }

  /** 合并后的全部模板（内置按当前语言解析） */
  function allTemplates(locale: string): SlashTemplateItem[] {
    return mergeTemplates(builtinTemplates, file.value, locale);
  }

  return {
    file,
    loading,
    loaded,
    fetch,
    saveCustom,
    removeCustom,
    setEnabled,
    allTemplates,
  };
});
