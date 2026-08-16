import type { CommandGroup, SlashCommand } from "./types";
import type { Profession } from "@/shared/enums/profession.enums";
import type { TemplateIconName } from "@/shared/enums/template.enums";
import type {
  LocalizedText,
  SlashTemplateItem,
} from "@/shared/types/template.types";
import { insertMarkdownTemplate } from "./helpers";
import { resolveTemplateIcon } from "./template-icons";

/** 内置模板的纯数据定义（双语） */
export interface BuiltInTemplateDef {
  id: string;
  profession: Profession;
  title: LocalizedText;
  description: LocalizedText;
  /** 图标键（@vicons/material Filled 变体），见 shared/enums/template.enums.ts */
  icon: TemplateIconName;
  markdown: LocalizedText;
}

/**
 * 内置模板清单。
 * 标题/描述/正文均以 { zh, en } 双语字面量声明，不再依赖 i18n 键；
 * 仅保留碎片化的输入型模板（待办/回顾/头脑风暴/需求/访谈/竞品/数据/纪要/计划/方案/……）；
 * profession 为 PROFESSION.GENERAL 的模板对所有职业可见。
 */
export const builtinTemplates: BuiltInTemplateDef[] = [
  {
    id: "todo",
    profession: "general",
    title: { zh: "待办清单", en: "Todo List" },
    description: {
      zh: "插入待办清单",
      en: "Insert a todo list",
    },
    icon: "check_circle",
    markdown: {
      zh: `## 待办清单 - {标题}
- [ ] {任务1}
- [ ] {任务2}
`,
      en: `## Todo List - {title}
- [ ] {task 1}
- [ ] {task 2}
`,
    },
  },
  {
    id: "daily-review",
    profession: "general",
    title: { zh: "每日回顾", en: "Daily Review" },
    description: {
      zh: "插入每日回顾框架",
      en: "Insert daily review skeleton",
    },
    icon: "wb_sunny",
    markdown: {
      zh: `## 每日回顾 - {日期}
- 今日完成：
- 遇到的问题：
- 明日计划：
`,
      en: `## Daily Review - {date}
- Done today:
- Blockers:
- Plan for tomorrow:
`,
    },
  },
  {
    id: "brainstorm",
    profession: "general",
    title: { zh: "头脑风暴", en: "Brainstorm" },
    description: {
      zh: "插入头脑风暴框架",
      en: "Insert brainstorm skeleton",
    },
    icon: "tips_and_updates",
    markdown: {
      zh: `## 头脑风暴 - {主题}
- 想法：
- 评估：
- 下一步：
`,
      en: `## Brainstorm - {topic}
- Ideas:
- Assessment:
- Next steps:
`,
    },
  },
  {
    id: "requirement",
    profession: "pm",
    title: { zh: "用户需求", en: "User Requirement" },
    description: {
      zh: "插入用户需求框架",
      en: "Insert user requirement skeleton",
    },
    icon: "push_pin",
    markdown: {
      zh: `- 需求：
- 用户故事：作为一名{角色}，我希望{功能}，以便{价值}
- 优先级：P0/P1/P2
`,
      en: `- Requirement:
- User story: As a {role}, I want {feature}, so that {value}
- Priority: P0/P1/P2
`,
    },
  },
  {
    id: "interview",
    profession: "pm",
    title: { zh: "用户访谈", en: "User Interview" },
    description: {
      zh: "插入用户访谈框架",
      en: "Insert user interview skeleton",
    },
    icon: "forum",
    markdown: {
      zh: `## 用户访谈 - {对象}
- 背景：
- 原话：
- 痛点：
`,
      en: `## User Interview - {subject}
- Background:
- Quotes:
- Pain points:
`,
    },
  },
  {
    id: "competitor",
    profession: "pm",
    title: { zh: "竞品观察", en: "Competitor Observation" },
    description: {
      zh: "插入竞品观察框架",
      en: "Insert competitor observation skeleton",
    },
    icon: "manage_search",
    markdown: {
      zh: `## 竞品观察 - {竞品名}
- 动态：
- 影响：
`,
      en: `## Competitor Observation - {product}
- Update:
- Impact:
`,
    },
  },
  {
    id: "data",
    profession: "pm",
    title: { zh: "产品数据", en: "Product Data" },
    description: { zh: "插入产品数据框架", en: "Insert product data skeleton" },
    icon: "insights",
    markdown: {
      zh: `- 指标：{} 数值：{} 同比：
- 假设：
- 验证：
`,
      en: `- Metric: {} Value: {} YoY:
- Hypothesis:
- Validation:
`,
    },
  },
  {
    id: "meeting",
    profession: "pm",
    title: { zh: "会议纪要", en: "Meeting Notes" },
    description: {
      zh: "插入会议纪要框架",
      en: "Insert meeting notes skeleton",
    },
    icon: "edit_note",
    markdown: {
      zh: `## 会议纪要 - {标题}
- 时间：
- 参会：
- 决策：
- 行动项：
`,
      en: `## Meeting Notes - {title}
- Time:
- Attendees:
- Decisions:
- Action items:
`,
    },
  },
  {
    id: "plan",
    profession: "pm",
    title: { zh: "工作计划", en: "Work Plan" },
    description: { zh: "插入工作计划框架", en: "Insert work plan skeleton" },
    icon: "calendar_month",
    markdown: {
      zh: `## 工作计划 - {主题}
- 周期：{起止时间}
- 目标：
- 任务：
  - [ ] {任务1}
  - [ ] {任务2}
- 风险与依赖：
`,
      en: `## Work Plan - {topic}
- Period: {start–end}
- Goals:
- Tasks:
  - [ ] {task 1}
  - [ ] {task 2}
- Risks & dependencies:
`,
    },
  },
  {
    id: "tech-design",
    profession: "developer",
    title: { zh: "技术方案", en: "Technical Design" },
    description: {
      zh: "插入技术方案框架",
      en: "Insert technical design skeleton",
    },
    icon: "extension",
    markdown: {
      zh: `## 技术方案 - {主题}
- 背景与目标：
- 方案对比：
- 选型理由：
- 架构图：
- 风险与回滚：
`,
      en: `## Technical Design - {topic}
- Background & goals:
- Options compared:
- Decision rationale:
- Architecture:
- Risks & rollback:
`,
    },
  },
  {
    id: "article",
    profession: "writer",
    title: { zh: "文章大纲", en: "Article Outline" },
    description: {
      zh: "插入文章大纲框架",
      en: "Insert article outline skeleton",
    },
    icon: "edit",
    markdown: {
      zh: `## 文章大纲 - {主题}
- 核心观点：
- 读者对象：
- 结构：
  - 引言：
  - 正文要点：
  - 结论：
- 素材/引用：
`,
      en: `## Article Outline - {topic}
- Core thesis:
- Target readers:
- Structure:
  - Intro:
  - Key points:
  - Conclusion:
- Materials/citations:
`,
    },
  },
  {
    id: "story",
    profession: "writer",
    title: { zh: "故事梗概", en: "Story Outline" },
    description: {
      zh: "插入故事梗概框架",
      en: "Insert story outline skeleton",
    },
    icon: "auto_stories",
    markdown: {
      zh: `## 故事梗概 - {标题}
- 人物：
- 设定：
- 冲突：
- 情节推进：
- 结局：
`,
      en: `## Story Outline - {title}
- Characters:
- Setting:
- Conflict:
- Plot progression:
- Ending:
`,
    },
  },
  {
    id: "idea",
    profession: "writer",
    title: { zh: "灵感记录", en: "Idea Capture" },
    description: {
      zh: "插入灵感记录框架",
      en: "Insert idea capture skeleton",
    },
    icon: "lightbulb",
    markdown: {
      zh: `## 灵感记录 - {主题}
- 触发点：
- 想法：
- 可能的发展方向：
`,
      en: `## Idea Capture - {topic}
- Trigger:
- Idea:
- Possible directions:
`,
    },
  },
  {
    id: "class-notes",
    profession: "student",
    title: { zh: "课堂笔记", en: "Class Notes" },
    description: {
      zh: "插入课堂笔记框架",
      en: "Insert class notes skeleton",
    },
    icon: "school",
    markdown: {
      zh: `## 课堂笔记 - {课程}
- 日期：
- 知识点：
- 例子：
- 疑问：
`,
      en: `## Class Notes - {course}
- Date:
- Key points:
- Examples:
- Questions:
`,
    },
  },
  {
    id: "review-outline",
    profession: "student",
    title: { zh: "复习提纲", en: "Study Outline" },
    description: {
      zh: "插入复习提纲框架",
      en: "Insert study outline skeleton",
    },
    icon: "library_books",
    markdown: {
      zh: `## 复习提纲 - {科目}
- 章节：
- 重点概念：
- 公式/定义：
- 易错点：
- 自测题：
`,
      en: `## Study Outline - {subject}
- Chapters:
- Key concepts:
- Formulas/definitions:
- Common mistakes:
- Practice questions:
`,
    },
  },
  {
    id: "reading-notes",
    profession: "student",
    title: { zh: "读书笔记", en: "Reading Notes" },
    description: {
      zh: "插入读书笔记框架",
      en: "Insert reading notes skeleton",
    },
    icon: "menu_book",
    markdown: {
      zh: `## 读书笔记 - {书名}
- 作者：
- 核心内容：
- 金句摘录：
- 我的思考：
`,
      en: `## Reading Notes - {book}
- Author:
- Core content:
- Quotes:
- My thoughts:
`,
    },
  },
  {
    id: "literature",
    profession: "researcher",
    title: { zh: "文献笔记", en: "Literature Note" },
    description: {
      zh: "插入文献阅读笔记框架",
      en: "Insert literature note skeleton",
    },
    icon: "science",
    markdown: {
      zh: `## 文献笔记 - {标题}
- 作者/年份：
- 核心观点：
- 方法：
- 结论：
- 与我的研究的关系：
`,
      en: `## Literature Note - {title}
- Author/Year:
- Core argument:
- Method:
- Findings:
- Relevance to my research:
`,
    },
  },
  {
    id: "experiment",
    profession: "researcher",
    title: { zh: "实验记录", en: "Experiment Log" },
    description: {
      zh: "插入实验记录框架",
      en: "Insert experiment log skeleton",
    },
    icon: "biotech",
    markdown: {
      zh: `## 实验记录 - {实验名}
- 假设：
- 方法：
- 变量：
- 结果：
- 结论：
`,
      en: `## Experiment Log - {experiment}
- Hypothesis:
- Method:
- Variables:
- Results:
- Conclusion:
`,
    },
  },
];

/** 由模板条目数组构建 Slash 命令组；空数组返回 null */
export function buildTemplateGroup(
  t: (key: string) => string,
  items: SlashTemplateItem[],
): CommandGroup | null {
  if (items.length === 0) return null;
  const commands: SlashCommand[] = items.map((tpl) => ({
    id: tpl.id,
    title: tpl.title,
    description: tpl.description,
    icon: resolveTemplateIcon(tpl.icon),
    action: ({ editor, pos }) => {
      insertMarkdownTemplate(editor, pos, tpl.markdown);
    },
  }));
  return {
    id: "template",
    label: t("EDITOR.SLASH.TEMPLATE.GROUP_LABEL"),
    items: commands,
  };
}
