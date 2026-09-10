import { creationSessionDao } from "@/main/core/db";
import { TimeUtil } from "@/shared/utils";
import type {
  CreationSession,
  CreationScope,
  CreationStage,
  GateKind,
} from "@/shared/types";

/** 各作用域的首个阶段 */
const INITIAL_STAGE: Record<CreationScope, CreationStage> = {
  work: "work.intake",
  page: "page.intake",
};

/**
 * 创作会话服务：阶段推进、确认门开关、逐项委托设置、可恢复会话查询。
 * 会话每步落库，支持中断后恢复（spec §6.4）。
 */
class CreationSessionService {
  private static instance: CreationSessionService | null = null;

  public static getInstance(): CreationSessionService {
    if (!CreationSessionService.instance) {
      CreationSessionService.instance = new CreationSessionService();
    }
    return CreationSessionService.instance;
  }

  public start(
    scope: CreationScope,
    projectId: string,
    pageId?: string,
  ): CreationSession {
    const now = TimeUtil.toISOString(Date.now());
    const session: CreationSession = {
      id: `cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      scope,
      projectId,
      pageId: pageId ?? null,
      stage: INITIAL_STAGE[scope],
      status: "active",
      pendingKind: null,
      delegation: {},
      createdAt: now,
      updatedAt: now,
    };
    creationSessionDao.insert(session);
    return session;
  }

  public advance(id: string, stage: CreationStage): CreationSession {
    return this.mutate(id, (s) => ({ ...s, stage }));
  }

  /** 开启确认门：置为等待确认并记录步骤类型 */
  public openGate(id: string, kind: GateKind): CreationSession {
    return this.mutate(id, (s) => ({
      ...s,
      status: "awaiting-confirm",
      pendingKind: kind,
    }));
  }

  /**
   * 关闭确认门。
   *
   * **只有 `approve` 才真正关闭**：`needs-user` 表示"仍需人工决定"，
   * 此时必须保持门开着（`awaiting-confirm`），否则等于把"交回人工"
   * 静默变成了"放行"——向放行方向失败是最危险的一类 bug。
   */
  public resolveGate(
    id: string,
    decision: "approve" | "needs-user",
  ): CreationSession {
    return this.mutate(id, (s) => {
      // 状态机守卫：没有待确认项时不得"关闭"确认门——
      // 否则会造出 awaiting-confirm 但 pendingKind 为 null 的非法会话，
      // 恢复流程（listResumable）会把它当成有未决事项。
      if (!s.pendingKind) {
        throw new Error(`GATE_NOT_OPEN: ${id}`);
      }
      if (decision === "needs-user") {
        // 仍需人工：保持门开着（不清 pendingKind）
        return { ...s, status: "awaiting-confirm" };
      }
      return { ...s, status: "active", pendingKind: null };
    });
  }

  /** 逐项设置委托自动确认开关 */
  public setDelegation(
    id: string,
    kind: GateKind,
    delegated: boolean,
  ): CreationSession {
    return this.mutate(id, (s) => ({
      ...s,
      delegation: { ...s.delegation, [kind]: delegated },
    }));
  }

  /** 启动后可恢复的会话（供"继续上次创作"提示） */
  public listResumable(): CreationSession[] {
    return creationSessionDao.listResumable();
  }

  private mutate(
    id: string,
    fn: (s: CreationSession) => CreationSession,
  ): CreationSession {
    const existing = creationSessionDao.findSessionById(id);
    if (!existing) throw new Error(`CREATION_SESSION_NOT_FOUND: ${id}`);

    const next: CreationSession = {
      ...fn(existing),
      updatedAt: TimeUtil.toISOString(Date.now()),
    };
    creationSessionDao.updateSession(next);
    return next;
  }
}

export const creationSessionService = CreationSessionService.getInstance();
