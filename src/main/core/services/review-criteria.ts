import type { ReviewStrictness, WritingPreference, WorkStyle } from "@/shared/types";

const STRICTNESS_TEXT: Record<ReviewStrictness, string> = {
  strict: "判定尺偏严：宁可交回人工，也不要放过可疑之处。",
  normal: "判定尺适中：仅放行高置信且无硬约束命中的产出。",
  lenient: "判定尺可放宽：轻微瑕疵可放行，但硬约束除外。",
};

/**
 * 构造审核判定标准（供 Reviewer 使用）。
 *
 * 禁忌与作品约束是**硬性标准**——命中即回退人工，永不自动放行，
 * 这条在任何严格度档位下都不免除（与 decideGateOutcome 的保守基调一致）。
 *
 * 复用 shared 的 `WorkStyle`，不另建同名结构，避免类型漂移。
 */
export function buildReviewCriteria(
  pref: WritingPreference,
  style?: WorkStyle,
): string {
  const lines: string[] = [STRICTNESS_TEXT[pref.reviewStrictness]];

  const hard: string[] = [];
  if (pref.taboos?.length) hard.push(...pref.taboos);
  if (style?.constraints?.length) hard.push(...style.constraints);
  if (hard.length > 0) {
    lines.push(`硬性禁忌（命中即交回人工）：${hard.join("、")}`);
  }

  if (style?.tone) lines.push(`基调应符合：${style.tone}`);
  if (style?.pov) lines.push(`叙事视角应保持：${style.pov}`);

  return lines.join("\n");
}
