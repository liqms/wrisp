import type { TemplatePageSkill } from "@/shared/types/template.types";

export interface PagePipelineStep {
  stepId: string;
  skillId: string;
  params: Record<string, unknown>;
  requiresConfirm: boolean;
}

/**
 * 把页面模板声明的页面级技能解析为可执行步骤序列。
 *
 * 参数合并：模板 `params` 为基础，运行时 `context` 覆盖同名键。
 * `requiresConfirm` 缺省为 true —— 保守起见，未显式声明即要求用户确认。
 * 技能 id 的解析（作品 → 全局）由执行方通过 resolveSkillDefinition 完成，
 * 本函数只负责把声明变成有序步骤。
 */
export function resolvePagePipeline(
  skills: TemplatePageSkill[] | undefined,
  context: Record<string, unknown>,
): PagePipelineStep[] {
  if (!skills || skills.length === 0) return [];

  return skills.map((s) => ({
    stepId: s.id,
    skillId: s.skillId,
    params: { ...(s.params ?? {}), ...context },
    requiresConfirm: s.requiresConfirm !== false,
  }));
}
