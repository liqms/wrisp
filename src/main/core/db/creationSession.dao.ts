import { BaseDao } from "./base.dao";
import type {
  CreationSession,
  CreationScope,
  CreationStage,
  CreationSessionStatus,
  GateKind,
} from "@/shared/types";

interface CreationSessionRow {
  id: string;
  scope: string;
  project_id: string;
  page_id: string | null;
  stage: string;
  status: string;
  pending_kind: string | null;
  delegation: string;
  created_at: string;
  updated_at: string;
}

export class CreationSessionDao extends BaseDao<
  CreationSessionRow,
  CreationSessionRow,
  Partial<CreationSessionRow>
> {
  constructor() {
    super("creation_sessions", { enabled: false }); // 时间戳由服务层管理
  }

  public insert(session: CreationSession): void {
    this.create(this.toRow(session));
  }

  /**
   * 按 id 取会话。
   * 注意：不覆盖 BaseDao.findById —— 后者返回的是**行类型** T，
   * 与本 DAO 对外暴露的领域对象 CreationSession 不同形，覆盖会触发 TS2416。
   */
  public findSessionById(id: string): CreationSession | null {
    const row = this.queryOne(`SELECT * FROM ${this.tableName} WHERE id = ?`, [
      id,
    ]) as CreationSessionRow | null;
    return row ? this.toEntity(row) : null;
  }

  public updateSession(session: CreationSession): void {
    this.update(session.id, this.toRow(session));
  }

  /** 可恢复的会话（供"继续上次创作"提示） */
  public listResumable(): CreationSession[] {
    const rows = this.query(
      `SELECT * FROM ${this.tableName}
       WHERE status IN ('active', 'awaiting-confirm', 'paused')
       ORDER BY updated_at DESC`,
    ) as CreationSessionRow[];
    return rows.map((r) => this.toEntity(r));
  }

  /** 供单测直接验证映射，不碰数据库 */
  public toEntityForTest(row: CreationSessionRow): CreationSession {
    return this.toEntity(row);
  }

  public toRowForTest(session: CreationSession): CreationSessionRow {
    return this.toRow(session);
  }

  private toRow(s: CreationSession): CreationSessionRow {
    return {
      id: s.id,
      scope: s.scope,
      project_id: s.projectId,
      page_id: s.pageId ?? null,
      stage: s.stage,
      status: s.status,
      pending_kind: s.pendingKind ?? null,
      delegation: JSON.stringify(s.delegation ?? {}),
      created_at: s.createdAt,
      updated_at: s.updatedAt,
    };
  }

  private toEntity(row: CreationSessionRow): CreationSession {
    return {
      id: row.id,
      scope: row.scope as CreationScope,
      projectId: row.project_id,
      pageId: row.page_id,
      stage: row.stage as CreationStage,
      status: row.status as CreationSessionStatus,
      pendingKind: (row.pending_kind as GateKind | null) ?? null,
      delegation: JSON.parse(row.delegation || "{}"),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const creationSessionDao = new CreationSessionDao();
