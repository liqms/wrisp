/** 审核宽严档位 */
export type ReviewStrictness = "lenient" | "normal" | "strict";

/** 用户写作偏好（跨作品，创作智能体使用） */
export interface WritingPreference {
  sentenceStyle?: string;
  tone?: string;
  pov?: string;
  pacing?: string;
  vocabulary?: string[];
  taboos?: string[];
  reviewStrictness: ReviewStrictness;
}
