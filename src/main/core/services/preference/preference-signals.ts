import type { WritingPreference } from "@/shared/types";

export type FeedbackAction = "confirm" | "edit" | "reject";

export interface PreferenceSuggestion {
  field: keyof WritingPreference;
  value: string;
  /** 触发该建议的反馈原文，供用户判断是否采纳 */
  reason: string;
}

/** 关键词 → 偏好字段（首版为规则匹配，后续可换模型判断，接口不变） */
const KEYWORD_RULES: Array<{
  field: keyof WritingPreference;
  keywords: string[];
  extract: (text: string) => string;
}> = [
  {
    field: "sentenceStyle",
    keywords: ["啰嗦", "冗长", "句式", "简短", "精炼"],
    extract: (text) => text.trim(),
  },
  {
    field: "tone",
    keywords: ["语气", "基调", "太凶", "太平"],
    extract: (text) => text.trim(),
  },
  {
    field: "pacing",
    keywords: ["节奏", "太快", "太慢", "拖沓"],
    extract: (text) => text.trim(),
  },
  {
    field: "taboos",
    keywords: ["不要出现", "禁忌", "别写"],
    extract: (text) => {
      const match = /(?:不要出现|禁忌|别写)(.*)$/.exec(text);
      return (match?.[1] ?? text).replace(/^[：:\s]+/, "").trim();
    },
  },
];

/**
 * 从用户反馈中提取偏好更新建议。
 *
 * **只产出建议，不落库**——落库前必须经用户确认（spec §6.3：
 * 先建议后确认，不静默修改用户画像）。
 * 确认（confirm）视为无信号：用户认可现状，无需改变偏好。
 */
export function extractPreferenceSignals(
  action: FeedbackAction,
  feedback: string,
): PreferenceSuggestion[] {
  if (action === "confirm") return [];

  const text = feedback.trim();
  if (!text) return [];

  const suggestions: PreferenceSuggestion[] = [];
  for (const rule of KEYWORD_RULES) {
    if (!rule.keywords.some((k) => text.includes(k))) continue;
    const value = rule.extract(text);
    if (!value) continue;
    suggestions.push({ field: rule.field, value, reason: text });
  }
  return suggestions;
}
