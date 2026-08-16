import type { Profession } from "@/shared/enums/profession.enums";

/** 双语文本：zh 为简体中文，en 为英文 */
export interface LocalizedText {
  zh: string;
  en: string;
}

/** 自定义模板（用户创建，存于工作区 JSON） */
export interface CustomTemplate {
  id: string;
  title: string;
  description: string;
  /** 图标键（@vicons/material Filled 变体键名，见 shared/enums/template.enums.ts） */
  icon: string;
  /** Markdown 模板正文 */
  markdown: string;
  profession: Profession;
  enabled: boolean;
}

/** 工作区 slash 模板文件内容（templates.json 的顶层结构） */
export interface SlashTemplateFile {
  /** 自定义模板列表 */
  customTemplates: CustomTemplate[];
  /** 被用户禁用的内置模板 id 黑名单 */
  disabledTemplateIds: string[];
}

/** 合并后的模板项（内置已按当前语言解析；设置页与 Slash 菜单共用） */
export interface SlashTemplateItem {
  id: string;
  title: string;
  description: string;
  /** 图标键（@vicons/material Filled 变体键名，见 shared/enums/template.enums.ts） */
  icon: string;
  markdown: string;
  profession: Profession;
  /** true=内置模板，false=自定义模板 */
  builtIn: boolean;
  enabled: boolean;
}
