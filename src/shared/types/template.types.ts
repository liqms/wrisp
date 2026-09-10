import type { Profession } from "@/shared/enums/profession.enums";
import type { ResourceType } from "@/shared/enums/resource.enums";
import type { TemplateIconName } from "@/shared/enums/template.enums";

/** 双语文本：zh 为简体中文，en 为英文 */
export interface LocalizedText {
  zh: string;
  en: string;
}

/**
 * 页面模板声明的页面级技能（方案 A：模板做编排、技能本体在全局/作品）。
 * id 为模板内步骤标识；skillId 引用技能 id（解析顺序：作品 → 全局）。
 */
export interface TemplatePageSkill {
  id: string;
  skillId: string;
  params?: Record<string, unknown>;
  /** 该步骤产出是否需用户确认；缺省视为需要确认（保守） */
  requiresConfirm?: boolean;
}

/** 自定义模板（用户创建，存于工作区 JSON；slash 与 page 按类型分文件存储） */
export interface CustomTemplate {
  id: string;
  title: string;
  description: string;
  /** 图标键（@vicons/material Filled 变体键名，见 shared/enums/template.enums.ts） */
  icon: string;
  /** Markdown 模板正文 */
  markdown: string;
  profession: Profession;
  /** 页面级技能（仅 page 模板使用；slash 模板留空） */
  skills?: TemplatePageSkill[];
  enabled: boolean;
}

/** 工作区模板文件内容（templates/{slash|page}/templates.json 的顶层结构） */
export interface TemplateFile {
  /** 自定义模板列表 */
  customTemplates: CustomTemplate[];
  /** 被用户禁用的内置模板 id 黑名单 */
  disabledTemplateIds: string[];
}

/** 内置模板的纯数据定义（双语，renderer 侧按类型提供清单） */
export interface BuiltInTemplateDef {
  id: string;
  profession: Profession;
  title: LocalizedText;
  description: LocalizedText;
  /** 图标键（@vicons/material Filled 变体），见 shared/enums/template.enums.ts */
  icon: TemplateIconName;
  markdown: LocalizedText;
}

/** 合并后的模板项（内置已按当前语言解析；设置页、Slash 菜单与新建页面弹窗共用） */
export interface TemplateItem {
  id: string;
  title: string;
  description: string;
  /** 图标键（@vicons/material Filled 变体键名，见 shared/enums/template.enums.ts） */
  icon: string;
  markdown: string;
  profession: Profession;
  /** 适用职业完整列表（内置模板可为多职业；自定义模板为单元素数组） */
  professions: Profession[];
  /** 版本号（内置模板来自资源文件；自定义模板为空字符串，展示时显示占位符） */
  version: string;
  /** 类型标签（内置模板来自资源文件；自定义模板为空数组） */
  tags: string[];
  /** true=内置模板，false=自定义模板 */
  builtIn: boolean;
  /** 页面级技能（仅 page 模板使用；slash 模板留空） */
  skills?: TemplatePageSkill[];
  enabled: boolean;
}

/**
 * 单个 slash/page 模板资源文件（resources/{slash|page}/{id}.json）。
 * 内置模板从工作区 resources/ 加载，与远程同步统一存储。
 * profession 为数组（支持多职业），含 version/tags/enabled 字段。
 */
export interface TemplateResourceFile {
  id: string;
  version: string;
  title: LocalizedText;
  description: LocalizedText;
  icon: TemplateIconName;
  markdown: LocalizedText;
  profession: Profession[];
  /** 类型标签（双语，渲染层按当前语言解析） */
  tags: LocalizedText[];
  /** 页面级技能（仅 page 模板使用；slash 模板留空） */
  skills?: TemplatePageSkill[];
  enabled: boolean;
}

/** 已安装资源清单（<workspace>/resources/installed.json），键为资源类型，值为 id 列表 */
export type InstalledResourceList = Partial<Record<ResourceType, string[]>>;

/** 模板市场条目（远程 manifest 元数据 + 文件内容 + 本地安装状态合并，三类资源通用） */
export interface MarketplaceItem {
  id: string;
  type: ResourceType; // slash | page | skill
  /** 远程最新版本 */
  version: string;
  title: LocalizedText;
  description: LocalizedText;
  /** 模板为图标名；技能为 emoji 字符串 */
  icon: string;
  tags: LocalizedText[];
  /** 预览内容：模板为 markdown，技能为 promptTemplate */
  preview: LocalizedText;
  /** 适用职业（仅命令/页面模板；技能为空数组） */
  profession: Profession[];
  /** 本地是否已安装（本地存在对应资源文件） */
  installed: boolean;
  /** 本地已安装版本（未安装为空串） */
  installedVersion: string;
  /** 是否有可用更新（已安装且本地版本 < 远程版本） */
  updateAvailable: boolean;
}

/** 模板市场目录（一次拉取的结果） */
export interface MarketplaceCatalog {
  items: MarketplaceItem[];
  /** 远程 manifest 是否拉取成功（false = 离线降级，仅本地已安装数据） */
  offline: boolean;
}
