import { ref } from "vue";
import { defineStore } from "pinia";
import type {
  CustomTemplate,
  TemplateFile,
  TemplateItem,
  TemplateResourceFile,
} from "@/shared/types/template.types";
import {
  TEMPLATE_TYPE,
  type TemplateType,
} from "@/shared/enums/template.enums";
import { RESOURCE_TYPE, type ResourceType } from "@/shared/enums/resource.enums";
import type {
  MarketplaceCatalog,
  MarketplaceItem,
} from "@/shared/types/template.types";
import { mergeTemplates } from "@/renderer/components/editor/slash/commands/template-merge";

export const useTemplateStore = defineStore("template", () => {
  /** 各类型的工作区模板文件（slash / page 分文件，按类型懒加载） */
  const files = ref<Record<TemplateType, TemplateFile | null>>({
    [TEMPLATE_TYPE.SLASH]: null,
    [TEMPLATE_TYPE.PAGE]: null,
  });
  /** 各类型的内置模板（从工作区 resources/ 加载，按类型懒加载） */
  const builtins = ref<Record<TemplateType, TemplateResourceFile[] | null>>({
    [TEMPLATE_TYPE.SLASH]: null,
    [TEMPLATE_TYPE.PAGE]: null,
  });
  const loading = ref<Record<TemplateType, boolean>>({
    [TEMPLATE_TYPE.SLASH]: false,
    [TEMPLATE_TYPE.PAGE]: false,
  });

  /** 指定类型是否已从主进程成功加载过（file 与 builtins 均就绪，避免重复拉取） */
  function isLoaded(type: TemplateType): boolean {
    return files.value[type] !== null && builtins.value[type] !== null;
  }

  /** 拉取指定类型的模板文件与内置模板（已加载或加载中则跳过） */
  async function fetch(type: TemplateType): Promise<void> {
    if (loading.value[type] || isLoaded(type)) return;
    loading.value[type] = true;
    try {
      const fileRes = await window.electronAPI.template.getFile(type);
      if (fileRes.success && fileRes.data) {
        files.value[type] = fileRes.data as TemplateFile;
      }
      const builtinRes = await window.electronAPI.template.getBuiltIn(type);
      if (builtinRes.success && builtinRes.data) {
        builtins.value[type] = builtinRes.data as TemplateResourceFile[];
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
      files.value[type] = res.data as TemplateFile;
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
      files.value[type] = res.data as TemplateFile;
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
      files.value[type] = res.data as TemplateFile;
      return true;
    }
    return false;
  }

  /** 监听 resource:updated 后清空缓存重新加载 */
  function invalidate(types: TemplateType[]): void {
    for (const type of types) {
      files.value[type] = null;
      builtins.value[type] = null;
    }
  }

  /** 各类型的市场目录（按类型懒加载，slash/page/skill） */
  const marketplace = ref<
    Partial<Record<ResourceType, MarketplaceCatalog | null>>
  >({
    [RESOURCE_TYPE.SLASH]: null,
    [RESOURCE_TYPE.PAGE]: null,
    [RESOURCE_TYPE.SKILL]: null,
  });

  /** 拉取指定类型的模板市场目录（force=true 强制绕过主进程缓存） */
  async function fetchMarketplace(
    type: ResourceType,
    force = false,
  ): Promise<void> {
    const res = await window.electronAPI.template.getMarketplace(type, force);
    if (res.success && res.data) {
      marketplace.value[type] = res.data as MarketplaceCatalog;
    }
  }

  function applyMarketplaceItem(
    type: ResourceType,
    entry: MarketplaceItem,
  ): void {
    const cat = marketplace.value[type];
    if (!cat) return;
    const i = cat.items.findIndex((e) => e.id === entry.id);
    if (i >= 0) cat.items[i] = entry;
  }

  /** 安装资源：更新市场条目，并使内置缓存失效后重新加载（设置页/Slash 菜单即时生效） */
  async function installMarketplace(
    type: ResourceType,
    id: string,
  ): Promise<boolean> {
    const res = await window.electronAPI.template.installMarketplace(type, id);
    if (res.success && res.data) {
      applyMarketplaceItem(type, res.data as MarketplaceItem);
      (builtins.value as Record<ResourceType, unknown>)[type] = null;
      await fetch(type as TemplateType);
      return true;
    }
    return false;
  }

  /** 卸载资源：更新市场条目，并使内置缓存失效后重新加载 */
  async function uninstallMarketplace(
    type: ResourceType,
    id: string,
  ): Promise<boolean> {
    const res = await window.electronAPI.template.uninstallMarketplace(
      type,
      id,
    );
    if (res.success && res.data) {
      applyMarketplaceItem(type, res.data as MarketplaceItem);
      (builtins.value as Record<ResourceType, unknown>)[type] = null;
      await fetch(type as TemplateType);
      return true;
    }
    return false;
  }

  /** 资源更新后清空市场缓存 */
  function invalidateMarketplace(types: ResourceType[]): void {
    for (const type of types) marketplace.value[type] = null;
  }

  /**
   * 合并后的全部模板（内置按当前语言解析）。
   * slash 与 page 共用此方法，内置模板由 builtins 提供。
   */
  function allTemplates(type: TemplateType, locale: string): TemplateItem[] {
    return mergeTemplates(
      builtins.value[type] ?? [],
      files.value[type],
      locale,
    );
  }

  return {
    files,
    builtins,
    marketplace,
    isLoaded,
    fetch,
    saveCustom,
    removeCustom,
    setEnabled,
    invalidate,
    invalidateMarketplace,
    allTemplates,
    fetchMarketplace,
    installMarketplace,
    uninstallMarketplace,
  };
});
