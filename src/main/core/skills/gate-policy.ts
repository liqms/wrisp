import type { GateKind } from "@/shared/types";

// 单一来源：审核严格度定义在 shared，避免与 AppConfig 里的同名类型漂移
import type { ReviewStrictness } from "@/shared/types";
export type { ReviewStrictness };

export interface GateContext {
  kind: GateKind;
  /** 用户是否为该步骤类型开启了委托 */
  delegated: boolean;
  reviewStrictness: ReviewStrictness;
  /** 是否命中硬约束（taboos / constraints / glossary / 事实一致性） */
  hitHardConstraint: boolean;
  /** Reviewer 的置信度 0..1 */
  confidence: number;
  /** 该类步骤是否已有历史校准 */
  calibrated: boolean;
}

const CONFIDENCE_THRESHOLD: Record<ReviewStrictness, number> = {
  strict: 0.95,
  normal: 0.8,
  lenient: 0.6,
};

/**
 * 确认门策略：决定"可自动放行"还是"必须交回人工"。
 *
 * 保守基调——任何不确定都回退人工：
 *   1) 未委托该步骤 → 人工；
 *   2) 命中硬约束 → 人工（lenient 档也不免除）；
 *   3) 尚无历史校准 → 人工；
 *   4) 置信度低于档位阈值 → 人工。
 *
 * 注意：`reject` 由 Reviewer 的内容判断产生，不属本函数职责。
 */
export function decideGateOutcome(
  ctx: GateContext,
): "approve" | "needs-user" {
  if (!ctx.delegated) return "needs-user";
  if (ctx.hitHardConstraint) return "needs-user";
  if (!ctx.calibrated) return "needs-user";
  if (ctx.confidence < CONFIDENCE_THRESHOLD[ctx.reviewStrictness]) {
    return "needs-user";
  }
  return "approve";
}
