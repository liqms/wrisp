import type { Profession } from "@/shared/enums/profession.enums";
import type { TemplateIconName } from "@/shared/enums/template.enums";

/** 双语文本：zh 为简体中文，en 为英文 */
export interface LocalizedText {
  zh: string;
  en: string;
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
  /** true=内置模板，false=自定义模板 */
  builtIn: boolean;
  enabled: boolean;
}
