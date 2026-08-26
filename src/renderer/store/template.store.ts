import { ref } from "vue";
import { defineStore } from "pinia";
import type {
  CustomTemplate,
  TemplateFile,
  TemplateItem,
} from "@/shared/types/template.types";
import {
  TEMPLATE_TYPE,
  type TemplateType,
} from "@/shared/enums/template.enums";
import { builtinTemplates } from "@/renderer/components/editor/slash/commands/templates";
import { builtinPageTemplates } from "@/renderer/templates/builtin-page-templates";
import { mergeTemplates } from "@/renderer/components/editor/slash/commands/template-merge";

export const useTemplateStore = defineStore("template", () => {
  /** 各类型的工作区模板文件（slash / page 分文件，按类型懒加载） */
  const files = ref<Record<TemplateType, TemplateFile | null>>({
    [TEMPLATE_TYPE.SLASH]: null,
    [TEMPLATE_TYPE.PAGE]: null,
  });
  const loading = ref<Record<TemplateType, boolean>>({
    [TEMPLATE_TYPE.SLASH]: false,
    [TEMPLATE_TYPE.PAGE]: false,
  });

  /** 指定类型是否已从主进程成功加载过（避免重复拉取） */
  function isLoaded(type: TemplateType): boolean {
    return files.value[type] !== null;
  }

  /** 拉取指定类型的模板文件（已加载或加载中则跳过） */
  async function fetch(type: TemplateType): Promise<void> {
    if (loading.value[type] || files.value[type]) return;
    loading.value[type] = true;
    try {
      const res = await window.electronAPI.template.getFile(type);
      if (res.success && res.data) {
        files.value[type] = res.data;
      }
    } finally {
      loading.value[type] = false;
    }
  }

  /** 新增或更新自定义模板，成功后同步本地对应类型的文件 */
  async function saveCustom(
    type: TemplateType,
    tpl: CustomTemplate,
  ): Promise<boolean> {
    const res = await window.electronAPI.template.upsertCustom(type, tpl);
    if (res.success && res.data) {
      files.value[type] = res.data;
      return true;
    }
    return false;
  }

  /** 删除自定义模板 */
  async function removeCustom(
    type: TemplateType,
    id: string,
  ): Promise<boolean> {
    const res = await window.electronAPI.template.deleteCustom(type, id);
    if (res.success && res.data) {
      files.value[type] = res.data;
      return true;
    }
    return false;
  }

  /** 设置启用状态（内置 builtIn=true 走黑名单；自定义 false 走 enabled 字段） */
  async function setEnabled(
    type: TemplateType,
    id: string,
    builtIn: boolean,
    enabled: boolean,
  ): Promise<boolean> {
    const res = await window.electronAPI.template.setEnabled(
      type,
      id,
      builtIn,
      enabled,
    );
    if (res.success && res.data) {
      files.value[type] = res.data;
      return true;
    }
    return false;
  }

  /**
   * 合并后的全部模板（内置按当前语言解析）。
   * slash 类型用 Slash 菜单清单；page 类型用页面文档清单。
   */
  function allTemplates(type: TemplateType, locale: string): TemplateItem[] {
    const builtins =
      type === TEMPLATE_TYPE.SLASH ? builtinTemplates : builtinPageTemplates;
    return mergeTemplates(builtins, files.value[type], locale);
  }

  return {
    files,
    isLoaded,
    fetch,
    saveCustom,
    removeCustom,
    setEnabled,
    allTemplates,
  };
});
