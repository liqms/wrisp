import { BaseDao } from "./base.dao";
import type {
  JournalEntryRow,
  JournalEntryRowCreate,
  JournalEntryRowUpdate,
} from "@/main/types/db";
import type {
  JournalDayView,
  JournalEntryView,
  JournalEntryBrief,
  Id,
} from "@/shared/types";

/**
 * 日志条目 DAO（journal_entries 表，日志真源）
 * 关联表约定：标签走多态表 tagged_items（entity_type = 'journal_entry'），
 * 作品走 journal_entry_projects。association 一律"先删后建"，由条目保存路径全量重建。
 * chunked_at 是阶段水位线：写它必须走 recordChunked（不刷 updated_at），
 * 否则脏判定 `updated_at > chunked_at` 会被自己顶高，条目无限重切（仿 ChunkDao.recordStage）。
 */
const ENTRY_TAG_ENTITY = "journal_entry";

export class JournalEntryDao extends BaseDao<
  JournalEntryRow,
  JournalEntryRowCreate,
  JournalEntryRowUpdate
> {
  constructor() {
    super("journal_entries", {
      enabled: true,
      createdAtField: "created_at",
      updatedAtField: "updated_at",
    });
  }

  listActiveByDate(date: string): JournalEntryRow[] {
    return this.query(
      `SELECT * FROM journal_entries
       WHERE date = ? AND deleted_at IS NULL
       ORDER BY occurred_at ASC, id ASC`,
      [date],
    );
  }

  listAllByDate(date: string): JournalEntryRow[] {
    return this.query(`SELECT * FROM journal_entries WHERE date = ?`, [date]);
  }

  listDirtyByDate(date: string): JournalEntryRow[] {
    return this.query(
      `SELECT * FROM journal_entries
       WHERE date = ? AND deleted_at IS NULL
         AND (chunked_at IS NULL OR updated_at > chunked_at)`,
      [date],
    );
  }

  recordChunked(id: Id, ts: string): void {
    // 直写水位线，绝不触碰 updated_at（绕过 update），否则会把脏判定顶成永久脏
    this.execute(`UPDATE journal_entries SET chunked_at = ? WHERE id = ?`, [ts, id]);
  }

  softDelete(id: Id, ts: string): number {
    return this.execute(
      `UPDATE journal_entries SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [ts, ts, id],
    ).changes;
  }

  listActiveDates(limit: number, beforeDate?: string): string[] {
    const sql = beforeDate
      ? `SELECT DISTINCT date FROM journal_entries
         WHERE deleted_at IS NULL AND date < ? ORDER BY date DESC LIMIT ?`
      : `SELECT DISTINCT date FROM journal_entries
         WHERE deleted_at IS NULL ORDER BY date DESC LIMIT ?`;
    const params = beforeDate ? [beforeDate, limit] : [limit];
    return (this.query(sql, params) as Array<{ date: string }>).map((r) => r.date);
  }

  hasActiveEntries(date: string): boolean {
    const row = this.queryOne(
      `SELECT 1 AS one FROM journal_entries WHERE date = ? AND deleted_at IS NULL LIMIT 1`,
      [date],
    ) as unknown as { one: number } | null;
    return row !== null;
  }

  /**
   * file_index 中存在 journal/% 文件、但当日无「活跃」条目的日期（旧版整篇 .md 待导入）。
   * 子查询过滤 deleted_at IS NULL：全软删的日期视同无条目，应重新入选导入入口。
   */
  listLegacyDates(limit: number): string[] {
    const sql = `
      SELECT DISTINCT fi.date AS date FROM file_index fi
      WHERE fi.file_path LIKE 'journal/%' AND fi.date IS NOT NULL
        AND fi.date NOT IN (
          SELECT DISTINCT date FROM journal_entries WHERE deleted_at IS NULL
        )
      ORDER BY fi.date DESC LIMIT ?`;
    return (this.query(sql, [limit]) as Array<{ date: string }>).map((r) => r.date);
  }

  replaceAssociations(
    entryId: Id,
    tagIds: string[],
    projectIds: string[],
    ts: string,
  ): void {
    this.transaction(() => {
      this.execute(`DELETE FROM tagged_items WHERE entity_type = ? AND entity_id = ?`, [
        ENTRY_TAG_ENTITY,
        entryId,
      ]);
      this.execute(`DELETE FROM journal_entry_projects WHERE entry_id = ?`, [entryId]);
      for (const tagId of tagIds) {
        this.execute(
          `INSERT OR IGNORE INTO tagged_items (tag_id, entity_type, entity_id, added_at)
           VALUES (?, ?, ?, ?)`,
          [tagId, ENTRY_TAG_ENTITY, entryId, ts],
        );
      }
      for (const projectId of projectIds) {
        this.execute(
          `INSERT OR IGNORE INTO journal_entry_projects (entry_id, project_id, added_at)
           VALUES (?, ?, ?)`,
          [entryId, projectId, ts],
        );
      }
    });
  }

  /** 按日期集合组装时间线视图（标签/作品 JOIN 一次带出，渲染层不逐条查询） */
  assembleViews(dates: string[]): JournalDayView[] {
    if (dates.length === 0) return [];
    const legacy = new Set(this.listLegacyDates(1000));
    const placeholders = dates.map(() => "?").join(",");
    const rows = this.query(
      `SELECT * FROM journal_entries
       WHERE date IN (${placeholders}) AND deleted_at IS NULL
       ORDER BY date DESC, occurred_at ASC, id ASC`,
      dates,
    );

    const entryIds = rows.map((r) => r.id);
    const tagByEntry = new Map<string, JournalEntryBrief[]>();
    const projectByEntry = new Map<string, JournalEntryBrief[]>();
    if (entryIds.length > 0) {
      const ep = entryIds.map(() => "?").join(",");
      const tagRows = this.query(
        `SELECT ti.entity_id AS entry_id, t.id, t.name
         FROM tagged_items ti JOIN tags t ON t.id = ti.tag_id
         WHERE ti.entity_type = ? AND ti.entity_id IN (${ep})
         ORDER BY t.name ASC`,
        [ENTRY_TAG_ENTITY, ...entryIds],
      ) as unknown as Array<{ entry_id: string; id: string; name: string }>;
      for (const r of tagRows) {
        const list = tagByEntry.get(r.entry_id) ?? [];
        list.push({ id: r.id, name: r.name });
        tagByEntry.set(r.entry_id, list);
      }
      const projectRows = this.query(
        `SELECT jep.entry_id, p.id, p.name
         FROM journal_entry_projects jep JOIN projects p ON p.id = jep.project_id
         WHERE jep.entry_id IN (${ep})
         ORDER BY p.name ASC`,
        entryIds,
      ) as unknown as Array<{ entry_id: string; id: string; name: string }>;
      for (const r of projectRows) {
        const list = projectByEntry.get(r.entry_id) ?? [];
        list.push({ id: r.id, name: r.name });
        projectByEntry.set(r.entry_id, list);
      }
    }

    const dayMap = new Map<string, JournalEntryView[]>();
    for (const row of rows) {
      const view: JournalEntryView = {
        id: row.id,
        date: row.date,
        occurred_at: row.occurred_at,
        source: row.source as JournalEntryView["source"],
        type: row.type as JournalEntryView["type"],
        content: row.content,
        chunked_at: row.chunked_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
        tags: tagByEntry.get(row.id) ?? [],
        projects: projectByEntry.get(row.id) ?? [],
      };
      const list = dayMap.get(row.date) ?? [];
      list.push(view);
      dayMap.set(row.date, list);
    }

    const result: JournalDayView[] = [];
    for (const date of dates) {
      result.push({
        date,
        has_legacy_file: legacy.has(date) && !dayMap.has(date),
        entries: dayMap.get(date) ?? [],
      });
    }
    return result;
  }

  /** 供 Service 按名称解析标签 id（不新建，缺失返回空数组） */
  findTagIdsByNames(names: string[]): Array<{ name: string; id: string }> {
    return names.flatMap((name) => {
      const row = this.queryOne(
        `SELECT id FROM tags WHERE name = ?`,
        [name],
      ) as { id: string } | null;
      return row ? [{ name, id: row.id }] : [];
    });
  }

  /** 供 Service 按名称解析作品 id（不新建，缺失返回空数组） */
  findProjectIdsByNames(names: string[]): Array<{ name: string; id: string }> {
    return names.flatMap((name) => {
      const row = this.queryOne(
        `SELECT id FROM projects WHERE name = ? AND status = 'active' LIMIT 1`,
        [name],
      ) as { id: string } | null;
      return row ? [{ name, id: row.id }] : [];
    });
  }
}
