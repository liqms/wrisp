import { PROJECT_TYPE, type ProjectType } from "@/shared/enums/project.enums";
import type { WorkBrief } from "@/shared/types";

export interface IntakeQuestion {
  key: keyof WorkBrief;
  prompt: string;
  required: boolean;
}

const BASE_QUESTIONS: IntakeQuestion[] = [
  { key: "name", prompt: "这部作品叫什么名字？", required: true },
  { key: "audience", prompt: "主要写给谁看？", required: false },
  { key: "tone", prompt: "希望整体基调是什么样的？", required: false },
  { key: "lengthTarget", prompt: "预期篇幅大概多少？", required: false },
  { key: "pov", prompt: "叙事视角打算用哪一种？", required: false },
  {
    key: "themes",
    prompt: "想表达哪些主题？（多个用逗号分隔）",
    required: false,
  },
  { key: "taboos", prompt: "有哪些内容是你明确不想要的？", required: false },
];

/** 按作品类型生成采集问题清单（研究类额外追问参考文献） */
export function buildIntakeQuestions(type: ProjectType): IntakeQuestion[] {
  if (type === PROJECT_TYPE.RESEARCH) {
    return [
      ...BASE_QUESTIONS,
      {
        key: "references",
        prompt: "有哪些关键的参考文献或资料来源？",
        required: false,
      },
    ];
  }
  return [...BASE_QUESTIONS];
}

/** 逗号分隔文本 → 字符串数组（中英文逗号均可，去空白、去空项） */
function splitList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const items = value
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return items.length > 0 ? items : undefined;
}

/** 把问答结果归集为作品简报；空值不注入字段 */
export function answersToWorkBrief(
  type: ProjectType,
  answers: Record<string, string>,
): WorkBrief {
  const brief: WorkBrief = {
    name: (answers.name ?? "").trim(),
    type,
  };

  if (answers.audience?.trim()) brief.audience = answers.audience.trim();
  if (answers.tone?.trim()) brief.tone = answers.tone.trim();
  if (answers.lengthTarget?.trim()) {
    brief.lengthTarget = answers.lengthTarget.trim();
  }
  if (answers.pov?.trim()) brief.pov = answers.pov.trim();

  const themes = splitList(answers.themes);
  if (themes) brief.themes = themes;
  const taboos = splitList(answers.taboos);
  if (taboos) brief.taboos = taboos;
  const references = splitList(answers.references);
  if (references) brief.references = references;

  return brief;
}
