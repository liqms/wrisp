/**
 * 模板类型枚举。
 * slash=斜杠命令模板（编辑器 Slash 菜单插入）；page=页面模板（新建页面时的文档初始内容）。
 * 模板文件（templates.json）中存的是这里的键名（字符串），按类型分文件存储。
 */
export const TEMPLATE_TYPE = {
  /** 斜杠命令模板：在编辑器 Slash 菜单中选中后插入正文 */
  SLASH: "slash",
  /** 页面模板：新建页面时作为文档初始内容 */
  PAGE: "page",
} as const;

export type TemplateType = (typeof TEMPLATE_TYPE)[keyof typeof TEMPLATE_TYPE];

/** 全部模板类型（用于遍历/校验） */
export const TEMPLATE_TYPES: readonly TemplateType[] = [
  TEMPLATE_TYPE.SLASH,
  TEMPLATE_TYPE.PAGE,
];

/** 判断值是否为合法的模板类型 */
export function isTemplateType(value: unknown): value is TemplateType {
  return (
    typeof value === "string" &&
    (TEMPLATE_TYPES as readonly string[]).includes(value)
  );
}

/**
 * 模板图标键枚举。
 * 内置模板与自定义模板共用同一套 @vicons/material（Filled 变体）图标；
 * 模板文件（templates.json）中存的是这里的键名（字符串），
 * 渲染时由 renderer 侧 template-icons.ts 把键名解析为图标组件。
 */
export const TEMPLATE_ICON_NAMES = [
  // 内置模板图标
  "check_circle",
  "wb_sunny",
  "tips_and_updates",
  "push_pin",
  "forum",
  "manage_search",
  "insights",
  "edit_note",
  "calendar_month",
  "extension",
  "edit",
  "auto_stories",
  "lightbulb",
  "school",
  "library_books",
  "menu_book",
  "science",
  "biotech",
  // 自定义模板可选图标
  "description",
  "notes",
  "task_alt",
  "event_note",
  "sticky_note",
  "summarize",
  "psychology",
  "auto_awesome",
  "rocket_launch",
  "code",
  "star",
  "flag",
  "bookmark",
  "folder",
  "fact_check",
  "assignment",
  "question_answer",
  "format_list_bulleted",
  "rule",
  "bolt",
  "verified",
  "account_balance",
  "text_snippet",
  "note_alt",
  "event",
  "draw",
  "history",
  "favorite",
] as const;

export type TemplateIconName = (typeof TEMPLATE_ICON_NAMES)[number];

/** 非法/缺失图标键时的兜底图标（旧版模板可能存的是 emoji 或内联 HTML） */
export const DEFAULT_TEMPLATE_ICON = "description";

/** 判断字符串是否为合法的模板图标键 */
export function isTemplateIconName(value: unknown): value is TemplateIconName {
  return (
    typeof value === "string" &&
    (TEMPLATE_ICON_NAMES as readonly string[]).includes(value)
  );
}
