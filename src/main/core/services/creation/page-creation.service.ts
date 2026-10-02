import type { GateKind } from "@/shared/types";
import type { ReviewStrictness } from "@/main/core/skills/gate-policy";
import type { GateContext } from "@/main/core/skills/gate-policy";

/** Reviewer 对某次产出的判定输入 */
export interface ReviewerSignal {
  confidence: number;
  hitHardConstraint: boolean;
  calibrated: boolean;
}

export interface DelegationCarrier {
  delegation: Partial<Record<GateKind, boolean>>;
}

/**
 * 与 `GateContext` **同一结构**——不做第二份声明，避免字段漂移
 * （例如将来给 GateContext 加 factsConsistent 时这里会静默落后）。
 */
export type PageGateContext = GateContext;

/**
 * 页面创作的**决策内核**。
 *
 * 实际执行（调技能、开关确认门、写回页面）需要渲染层参与——用户要点"生成"、
 * 过大纲确认、逐节确认。把它塞进主进程服务会让本模块无法单测，
 * 因此这里只负责可判定的部分，判定结果交给 decideGateOutcome 使用。
 */
class PageCreationService {
  private static instance: PageCreationService | null = null;

  public static getInstance(): PageCreationService {
    if (!PageCreationService.instance) {
      PageCreationService.instance = new PageCreationService();
    }
    return PageCreationService.instance;
  }

  /** 用户是否选择了自动生成大纲 */
  public shouldGenerateOutline(needsOutline: boolean): boolean {
    return needsOutline === true;
  }

  /**
   * 构造确认门上下文。
   * 只做"如实搬运"：是否放行由 decideGateOutcome 按保守策略决定，
   * 本方法不得提前放行（尤其不得吞掉 hitHardConstraint）。
   */
  public buildGateContext(
    session: DelegationCarrier,
    kind: GateKind,
    reviewer: ReviewerSignal,
    reviewStrictness: ReviewStrictness,
  ): PageGateContext {
    return {
      kind,
      delegated: session.delegation[kind] === true,
      reviewStrictness,
      hitHardConstraint: reviewer.hitHardConstraint,
      confidence: reviewer.confidence,
      calibrated: reviewer.calibrated,
    };
  }
}

export const pageCreationService = PageCreationService.getInstance();
