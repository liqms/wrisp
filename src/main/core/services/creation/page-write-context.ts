import type { WorkBrief, WorkStyle } from "@/shared/types";

export interface PageWriteContextInput {
  brief: WorkBrief;
  style?: WorkStyle;
  pageTitle: string;
  overview: string;
  templateSkeleton?: string;
}

/**
 * 装配页面创作的技能输入。
 *
 * - 作品风格（单作品、更具体）优先于作品简报中的同名字段；
 * - 缺失字段不注入，避免把空串喂给模型（空串可能被当成一种约束）；
 * - 多值字段用「、」连接，便于提示词阅读。
 */
export function buildPageWriteInputs(
  input: PageWriteContextInput,
): Record<string, unknown> {
  const { brief, style, pageTitle, overview, templateSkeleton } = input;

  const result: Record<string, unknown> = {
    workName: brief.name,
    workType: brief.type,
    pageTitle,
    overview,
  };

  const tone = style?.tone ?? brief.tone;
  if (tone) result.tone = tone;
  const pov = style?.pov ?? brief.pov;
  if (pov) result.pov = pov;

  if (brief.audience) result.audience = brief.audience;
  if (brief.lengthTarget) result.lengthTarget = brief.lengthTarget;
  if (brief.themes?.length) result.themes = brief.themes.join("、");
  if (brief.taboos?.length) result.taboos = brief.taboos.join("、");
  if (style?.constraints?.length) {
    result.constraints = style.constraints.join("、");
  }
  if (templateSkeleton) result.templateSkeleton = templateSkeleton;

  return result;
}
