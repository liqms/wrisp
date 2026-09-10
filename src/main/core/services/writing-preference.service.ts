import { configService } from "@/main/core/services/config.service";
import { Logger } from "@/main/utils/logger";
import type { WritingPreference } from "@/shared/types";
import type { PreferenceSuggestion } from "./preference-signals";

const CONFIG_KEY = "writingPreference";

const DEFAULT_PREFERENCE: WritingPreference = {
  taboos: [],
  vocabulary: [],
  reviewStrictness: "normal",
};

/** 标量偏好字段（可直接被建议覆盖） */
type ScalarField = "sentenceStyle" | "tone" | "pov" | "pacing";

/**
 * 把偏好建议合并进当前偏好。
 *
 * - 标量字段：直接覆盖；
 * - 数组成员：去重后追加；
 * - `reviewStrictness`：**不因反馈自动改写**——它决定审核宽严，
 *   被单次反馈左右会放大风险（例如一次打回就把 strict 降成 lenient，
 *   此后所有产出都会放宽）。
 * - 不修改入参（无副作用）。
 */
export function mergePreferences(
  current: WritingPreference,
  suggestions: PreferenceSuggestion[],
): WritingPreference {
  const next: WritingPreference = { ...current };
  if (current.taboos) next.taboos = [...current.taboos];
  if (current.vocabulary) next.vocabulary = [...current.vocabulary];

  for (const s of suggestions) {
    if (s.field === "taboos" || s.field === "vocabulary") {
      const existing = next[s.field] ?? [];
      if (!existing.includes(s.value)) {
        next[s.field] = [...existing, s.value];
      }
      continue;
    }
    if (s.field === "reviewStrictness") continue;

    next[s.field as ScalarField] = s.value;
  }

  return next;
}

/**
 * 用户写作偏好读写。
 *
 * **写入仅经 applySuggestions**，调用方必须先经由确认门取得用户同意
 * （spec §6.3：先建议、后确认）。本方法自身不做确认。
 */
class WritingPreferenceService {
  private static instance: WritingPreferenceService | null = null;

  public static getInstance(): WritingPreferenceService {
    if (!WritingPreferenceService.instance) {
      WritingPreferenceService.instance = new WritingPreferenceService();
    }
    return WritingPreferenceService.instance;
  }

  public read(): WritingPreference {
    const raw = configService.getValue<Partial<WritingPreference>>(CONFIG_KEY);
    return {
      ...DEFAULT_PREFERENCE,
      ...(raw ?? {}),
      taboos: raw?.taboos ?? [],
      vocabulary: raw?.vocabulary ?? [],
    };
  }

  /** 应用「已获用户确认」的偏好建议并落库 */
  public applySuggestions(
    suggestions: PreferenceSuggestion[],
  ): WritingPreference {
    const next = mergePreferences(this.read(), suggestions);
    configService.setValue(CONFIG_KEY, next);
    Logger.info("[WritingPreferenceService] 偏好已更新", {
      fields: suggestions.map((s) => s.field),
    });
    return next;
  }
}

export const writingPreferenceService = WritingPreferenceService.getInstance();
