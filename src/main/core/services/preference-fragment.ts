import type { WritingPreference } from "@/shared/types";

// 单一来源：写作偏好与审核严格度定义在 shared/types/writing-preference.types.ts，
// 此处仅再导出，避免与 AppConfig 中的同名类型漂移。
export type { WritingPreference };

/**
 * 把用户写作偏好组织为注入提示的片段。
 *
 * - 只含**影响写作**的字段；`reviewStrictness` 属审核设定，不在此处；
 * - 无可用内容时返回空串——空片段注入提示词只会变成噪音，
 *   甚至被模型误当成某种约束。
 */
export function buildPreferenceFragment(
  pref: WritingPreference | undefined,
): string {
  if (!pref) return "";

  const lines: string[] = [];
  if (pref.sentenceStyle) lines.push(`句式：${pref.sentenceStyle}`);
  if (pref.tone) lines.push(`基调：${pref.tone}`);
  if (pref.pov) lines.push(`视角：${pref.pov}`);
  if (pref.pacing) lines.push(`节奏：${pref.pacing}`);
  if (pref.vocabulary?.length) {
    lines.push(`用词偏好：${pref.vocabulary.join("、")}`);
  }
  if (pref.taboos?.length) lines.push(`禁忌：${pref.taboos.join("、")}`);

  if (lines.length === 0) return "";
  return `写作偏好：\n${lines.map((l) => `- ${l}`).join("\n")}`;
}
