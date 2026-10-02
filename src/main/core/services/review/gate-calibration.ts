import type { GateKind } from "@/shared/types";

/** 一次已完成的确认门记录（用于推导该类步骤是否已"校准"） */
export interface GateHistoryEntry {
  kind: GateKind;
  /** approved=被放行（用户确认或委托放行）；revised=被打回重写 */
  outcome: "approved" | "revised";
}

const DEFAULT_THRESHOLD = 3;

/**
 * 判断某类步骤是否已"校准"——即系统对该作品在这类步骤上的偏好已有足够把握，
 * 可以进入委托自动审核的候选范围。
 *
 * 规则（保守）：
 *   - 只看**最近的连续放行**：一旦出现 revised 就清零重来，
 *     避免"早期放行几次"永久解锁自动放行；
 *   - 达到阈值才为 true（默认 3 次）；
 *   - 只统计同类步骤。
 *
 * 为什么需要它：`calibrated` 是 `decideGateOutcome` 的「首次执行必须人工」防线。
 * 它**必须由数据派生**，不能由调用方自由传入 true —— 否则一次性绕过该防线。
 * 数据源（确认门历史）随接线层落库；本函数是其唯一的判定实现。
 */
export function isCalibrated(
  kind: GateKind,
  history: GateHistoryEntry[],
  threshold: number = DEFAULT_THRESHOLD,
): boolean {
  const forKind = history.filter((h) => h.kind === kind);

  let streak = 0;
  for (let i = forKind.length - 1; i >= 0; i--) {
    if (forKind[i].outcome !== "approved") break;
    streak++;
  }

  return streak >= threshold;
}
