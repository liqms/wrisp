import type { SkillDefinition } from "@/shared/types/skill.types";
import type { WorkBrief } from "@/shared/types";

/** 简报字段 → 技能输入参数名（用于填充默认值） */
const BRIEF_TO_INPUT: Array<keyof WorkBrief> = [
  "audience",
  "tone",
  "pov",
  "lengthTarget",
];

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * 从全局技能派生作品技能（方案 B：独立副本，可后续编辑）。
 *
 * - 不修改来源对象（deep clone）；
 * - 复制全部字段，写入来源模板 id / 版本，供"有更新可用"提示；
 * - 把简报中已有的同名信息填进输入参数默认值（仅 string 类型参数，
 *   且不覆盖模型本该自行推断的参数）。
 */
export function deriveWorkSkill(
  source: SkillDefinition,
  brief: WorkBrief,
  targetId: string,
): SkillDefinition {
  const derived = deepClone(source);
  derived.id = targetId;
  derived.sourceTemplateId = source.id;
  derived.sourceTemplateVersion = source.version;

  const properties = derived.input?.properties;
  if (properties) {
    for (const key of BRIEF_TO_INPUT) {
      const value = brief[key];
      const prop = properties[key];
      if (typeof value === "string" && prop && prop.type === "string") {
        prop.default = value;
      }
    }
  }

  return derived;
}
