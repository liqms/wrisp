/** 创作会话作用域 */
export type CreationScope = "work" | "page";

/** 创作阶段（与 spec §4.4 状态机一致） */
export type CreationStage =
  | "work.intake"
  | "work.skill_draft"
  | "work.structure"
  | "work.done"
  | "page.intake"
  | "page.outline_draft"
  | "page.outline_confirm"
  | "page.write"
  | "page.review"
  | "page.done";

export type CreationSessionStatus =
  | "active"
  | "awaiting-confirm"
  | "paused"
  | "completed"
  | "aborted";

/** 确认门步骤类型，也是委托开关的粒度 */
export type GateKind = "brief" | "skill" | "outline" | "section" | "review";

/** 确认门判定结果（reject 由 Reviewer 内容判断产生） */
export type GateDecision = "approve" | "reject" | "needs-user";

export interface CreationSession {
  id: string;
  scope: CreationScope;
  projectId: string;
  pageId?: string | null;
  stage: CreationStage;
  status: CreationSessionStatus;
  /** 当前等待确认的步骤类型；无待确认项为 null */
  pendingKind?: GateKind | null;
  /** 委托自动确认的逐项开关（缺省视为未委托） */
  delegation: Partial<Record<GateKind, boolean>>;
  createdAt: string;
  updatedAt: string;
}
