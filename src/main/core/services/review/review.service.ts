import { decideGateOutcome } from "@/main/core/skills/gate-policy";
import { parseReviewOutcome } from "./review-outcome";
import {
  detectHardConstraintHit,
  type ConstraintHit,
  type HardConstraintSet,
} from "./hard-constraint";
import { buildRevisionInstruction } from "./revision-instruction";
import type { GateKind, ReviewStrictness } from "@/shared/types";

export interface ReviewInput {
  /** Reviewer 模型的原始输出 */
  rawReview: string;
  /** 被审核的产出正文 */
  text: string;
  constraints: HardConstraintSet;
  session: { delegation: Partial<Record<GateKind, boolean>> };
  kind: GateKind;
  reviewStrictness: ReviewStrictness;
  /** 该类步骤是否已有历史校准 */
  calibrated: boolean;
}

export interface ReviewDecision {
  /** 最终结果：approve=自动放行；needs-user=交回人工 */
  outcome: "approve" | "needs-user";
  /** Reviewer 的原始判定（reject 时需展示其问题清单） */
  reviewerDecision: "approve" | "reject" | "needs-user";
  issues: string[];
  hit: ConstraintHit | null;
  /** 打回时供重写使用的局部修正指令 */
  revisionInstruction: string;
}

/**
 * 审核编排：解析 Reviewer 输出 → 检测硬约束 → 交确认门策略判定。
 *
 * 三条保守规则，顺序不可调换：
 *   1) **硬约束命中一律回退人工**——不进入策略层，Reviewer 说 approve 也不算数；
 *   2) Reviewer 未判 approve 时透传其判定，不做自动放行；
 *   3) 其余交给 `decideGateOutcome`（逐项委托 / 严格度 / 置信度 / 历史校准）。
 *
 * 也就是说：**任何一条不确定，结果都是交回人工**。
 */
class ReviewService {
  private static instance: ReviewService | null = null;

  public static getInstance(): ReviewService {
    if (!ReviewService.instance) {
      ReviewService.instance = new ReviewService();
    }
    return ReviewService.instance;
  }

  public evaluateAndDecide(input: ReviewInput): ReviewDecision {
    const reviewer = parseReviewOutcome(input.rawReview);
    const hit = detectHardConstraintHit(input.text, input.constraints);
    const issues = reviewer.issues;
    const revisionInstruction = buildRevisionInstruction(issues);

    if (hit) {
      return {
        outcome: "needs-user",
        reviewerDecision: reviewer.decision,
        issues,
        hit,
        revisionInstruction,
      };
    }

    if (reviewer.decision !== "approve") {
      return {
        outcome: "needs-user",
        reviewerDecision: reviewer.decision,
        issues,
        hit: null,
        revisionInstruction,
      };
    }

    const outcome = decideGateOutcome({
      kind: input.kind,
      delegated: input.session.delegation[input.kind] === true,
      reviewStrictness: input.reviewStrictness,
      hitHardConstraint: false,
      confidence: reviewer.confidence,
      calibrated: input.calibrated,
    });

    return {
      outcome,
      reviewerDecision: reviewer.decision,
      issues,
      hit: null,
      revisionInstruction,
    };
  }
}

export const reviewService = ReviewService.getInstance();
