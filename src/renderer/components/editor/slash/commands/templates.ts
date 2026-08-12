import type { CommandGroup } from "./types";
import type { Profession } from "@/shared/enums/profession.enums";
import { insertMarkdownTemplate } from "./helpers";

/** 模板的纯数据定义 */
export interface Template {
  id: string;
  /** 所属职业标签（用于按职业过滤） */
  profession: Profession;
  /** i18n 键，用于标题（如 EDITOR.SLASH.PM_TEMPLATE.REQUIREMENT_TITLE） */
  titleKey: string;
  /** i18n 键，用于描述 */
  descKey: string;
  /** 图标 HTML */
  icon: string;
  /** 模板 Markdown 骨架 */
  markdown: string;
}

/** 按职业过滤模板 */
export function getTemplatesByProfession(
  templates: Template[],
  profession: Profession,
): Template[] {
  return templates.filter((tpl) => tpl.profession === profession);
}

/**
 * 内置模板清单（新增模板在此追加一项并标上职业标签即可）
 * 仅保留碎片化的输入型模板（用户需求 / 用户访谈 / 竞品观察 / 产品数据 / 会议纪要）。
 * 长内容的结构化输出模板（如 PRD、MRD、Roadmap）不属于 Journal 输入范畴，归入 Project 作品创作空间。
 */
export const templates: Template[] = [
  {
    id: "requirement",
    profession: "pm",
    titleKey: "EDITOR.SLASH.PM_TEMPLATE.REQUIREMENT_TITLE",
    descKey: "EDITOR.SLASH.PM_TEMPLATE.REQUIREMENT_DESC",
    icon: '<span style="font-size:14px">📌</span>',
    markdown: `- 需求：
- 用户故事：作为一名{角色}，我希望{功能}，以便{价值}
- 优先级：P0/P1/P2
`,
  },
  {
    id: "interview",
    profession: "pm",
    titleKey: "EDITOR.SLASH.PM_TEMPLATE.INTERVIEW_TITLE",
    descKey: "EDITOR.SLASH.PM_TEMPLATE.INTERVIEW_DESC",
    icon: '<span style="font-size:14px">💬</span>',
    markdown: `## 用户访谈 - {对象}
- 背景：
- 原话：
- 痛点：
`,
  },
  {
    id: "competitor",
    profession: "pm",
    titleKey: "EDITOR.SLASH.PM_TEMPLATE.COMPETITOR_TITLE",
    descKey: "EDITOR.SLASH.PM_TEMPLATE.COMPETITOR_DESC",
    icon: '<span style="font-size:14px">🔍</span>',
    markdown: `## 竞品观察 - {竞品名}
- 动态：
- 影响：
`,
  },
  {
    id: "data",
    profession: "pm",
    titleKey: "EDITOR.SLASH.PM_TEMPLATE.DATA_TITLE",
    descKey: "EDITOR.SLASH.PM_TEMPLATE.DATA_DESC",
    icon: '<span style="font-size:14px">📈</span>',
    markdown: `- 指标：{} 数值：{} 同比：
- 假设：
- 验证：
`,
  },
  {
    id: "meeting",
    profession: "pm",
    titleKey: "EDITOR.SLASH.PM_TEMPLATE.MEETING_TITLE",
    descKey: "EDITOR.SLASH.PM_TEMPLATE.MEETING_DESC",
    icon: '<span style="font-size:14px">📝</span>',
    markdown: `## 会议纪要 - {标题}
- 时间：
- 参会：
- 决策：
- 行动项：
`,
  },
  {
    id: "plan",
    profession: "pm",
    titleKey: "EDITOR.SLASH.PM_TEMPLATE.PLAN_TITLE",
    descKey: "EDITOR.SLASH.PM_TEMPLATE.PLAN_DESC",
    icon: '<span style="font-size:14px">🗓️</span>',
    markdown: `## 工作计划 - {主题}
- 周期：{起止时间}
- 目标：
- 任务：
  - [ ] {任务1}
  - [ ] {任务2}
- 优先级：P0/P1/P2
- 风险与依赖：
`,
  },
];

/** 由模板数组 + 职业构建 Slash 命令组；无匹配模板时返回 null */
export function buildTemplateGroup(
  t: (key: string) => string,
  profession: Profession,
): CommandGroup | null {
  const matched = getTemplatesByProfession(templates, profession);
  if (matched.length === 0) return null;
  return {
    id: "template",
    label: t("EDITOR.SLASH.PM_TEMPLATE.GROUP_LABEL"),
    items: matched.map((tpl) => ({
      id: tpl.id,
      title: t(tpl.titleKey),
      description: t(tpl.descKey),
      icon: tpl.icon,
      action: ({ editor, pos }) => {
        insertMarkdownTemplate(editor, pos, tpl.markdown);
      },
    })),
  };
}
