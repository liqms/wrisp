/** Reviewer 对一次产出的结构化判定 */
export interface ReviewOutcome {
  decision: "approve" | "reject" | "needs-user";
  /** 0..1 */
  confidence: number;
  /** 打回时的具体问题（用于构造局部修正指令） */
  issues: string[];
}

const FALLBACK: ReviewOutcome = {
  decision: "needs-user",
  confidence: 0,
  issues: [],
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), 1);
}

/** 从可能被 Markdown 代码块包裹的文本中取出 JSON 对象 */
function extractJson(raw: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

/**
 * 解析 Reviewer 的原始输出。
 *
 * **任何无法识别的情况一律保守回退为 `needs-user`（置信度 0）**——
 * 解析失败绝不等于"可以放行"。这是整个委托机制的安全底线：
 * 最坏的结果是"多问用户一次"，而不是"把没审明白的产出放过去"。
 */
export function parseReviewOutcome(raw: string): ReviewOutcome {
  const json = extractJson(raw ?? "");
  if (!json) return { ...FALLBACK };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ...FALLBACK };
  }
  if (!parsed || typeof parsed !== "object") return { ...FALLBACK };

  const obj = parsed as Record<string, unknown>;
  const decision = obj.decision;
  if (
    decision !== "approve" &&
    decision !== "reject" &&
    decision !== "needs-user"
  ) {
    return { ...FALLBACK };
  }

  const confidence =
    typeof obj.confidence === "number" ? clamp01(obj.confidence) : 0;
  const issues = Array.isArray(obj.issues)
    ? obj.issues.filter(
        (i): i is string => typeof i === "string" && i.trim() !== "",
      )
    : [];

  return { decision, confidence, issues };
}
