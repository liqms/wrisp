export interface HardConstraintSet {
  /** 用户禁忌（来自写作偏好） */
  taboos?: string[];
  /** 作品约束（来自作品风格） */
  constraints?: string[];
  /** 需要逐词检查的禁用词（如"不要出现现代词汇" → ["手机","短视频"]） */
  forbiddenWords?: string[];
  /** 专有名词表 */
  glossary?: Array<{ term: string; definition: string }>;
  /**
   * 为真时：出现 glossary 中的专名即视为命中（用于"专名不得改动"类约束）。
   * 缺省为 false —— 单纯出现专名不算违规，避免误报。
   */
  glossaryMustMatch?: boolean;
}

export interface ConstraintHit {
  kind: "taboo" | "constraint" | "glossary";
  constraint: string;
}

/**
 * 检测文本是否命中硬约束。
 *
 * 命中即意味着"永不自动放行"——由确认门交回人工（spec §6.1），
 * 无论 Reviewer 给出多高的置信度。
 *
 * 首版为字面包含匹配，是兜底防线（同义改写可绕过）；后续可加入模型判定，
 * 接口不变。
 */
export function detectHardConstraintHit(
  text: string,
  set: HardConstraintSet,
): ConstraintHit | null {
  if (!text) return null;

  for (const taboo of set.taboos ?? []) {
    if (taboo && text.includes(taboo)) {
      return { kind: "taboo", constraint: taboo };
    }
  }

  for (const word of set.forbiddenWords ?? []) {
    if (word && text.includes(word)) {
      return { kind: "constraint", constraint: word };
    }
  }

  for (const rule of set.constraints ?? []) {
    if (rule && text.includes(rule)) {
      return { kind: "constraint", constraint: rule };
    }
  }

  if (set.glossaryMustMatch) {
    for (const entry of set.glossary ?? []) {
      if (entry.term && text.includes(entry.term)) {
        return { kind: "glossary", constraint: entry.term };
      }
    }
  }

  return null;
}
