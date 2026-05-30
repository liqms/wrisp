import { BaseDao } from "./base.dao";
import {
  Project,
  ProjectCreate,
  ProjectUpdate,
  ProjectQuery,
  ProjectId,
  Name,
  ProjectWithStats,
} from "@/main/types/db";

type FindByField = "name" | "type";

export class ProjectDao extends BaseDao<Project, ProjectCreate, ProjectUpdate> {
  constructor() {
    super("projects");
  }

  findBy(field: FindByField, value: string): Project[] {
    const isNameField = field === "name";
    const orderBy = isNameField ? "name" : "created_at";
    const direction = isNameField ? "ASC" : "DESC";
    const sql = `SELECT * FROM ${this.tableName} WHERE ${field} = ? ORDER BY ${orderBy} ${direction}`;
    return this.query(sql, [value]);
  }

  findWithStats(id: ProjectId): ProjectWithStats | null;
  findWithStats(): ProjectWithStats[];
  findWithStats(id?: ProjectId): ProjectWithStats | ProjectWithStats[] | null {
    if (id) {
      const sql = `
        SELECT p.*,
          COALESCE(pb.block_count, 0) AS block_count,
          COALESCE(pg.page_count, 0) AS page_count
        FROM ${this.tableName} p
        LEFT JOIN (
          SELECT project_id, COUNT(*) AS block_count
          FROM project_blocks
          GROUP BY project_id
        ) pb ON pb.project_id = p.id
        LEFT JOIN (
          SELECT project_id, COUNT(*) AS page_count
          FROM pages
          WHERE status = 'active'
          GROUP BY project_id
        ) pg ON pg.project_id = p.id
        WHERE p.id = ?
      `;

      return this.queryOne(sql, [id]) as ProjectWithStats | null;
    }

    const sql = `
      SELECT p.*,
        COALESCE(pb.block_count, 0) AS block_count,
        COALESCE(pg.page_count, 0) AS page_count
      FROM ${this.tableName} p
      LEFT JOIN (
        SELECT project_id, COUNT(*) AS block_count
        FROM project_blocks
        GROUP BY project_id
      ) pb ON pb.project_id = p.id
      LEFT JOIN (
        SELECT project_id, COUNT(*) AS page_count
        FROM pages
        WHERE status = 'active'
        GROUP BY project_id
      ) pg ON pg.project_id = p.id
      ORDER BY p.created_at DESC
    `;

    return this.query(sql) as ProjectWithStats[];
  }

  findByNameLike(name: string): Project[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE name LIKE ? ORDER BY name ASC`;
    return this.query(sql, [`%${name}%`]);
  }

  checkNameExists(name: Name, excludeId?: ProjectId): boolean {
    const excludeClause = excludeId ? " AND id != ?" : "";
    const sql = `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE name = ?${excludeClause}) as exists`;
    const params: unknown[] = excludeId ? [name, excludeId] : [name];

    const stmt = this.db.prepare(sql);
    const result = stmt.get(params) as { exists: number };
    return result?.exists === 1;
  }

  protected buildWhereClause(conditions: ProjectQuery): {
    sql: string;
    values: unknown[];
  } {
    const conditionsArray: string[] = [];
    const values: unknown[] = [];

    if (conditions.name !== undefined) {
      conditionsArray.push("name = ?");
      values.push(conditions.name);
    }
    if (conditions.type !== undefined) {
      conditionsArray.push("type = ?");
      values.push(conditions.type);
    }

    const sql =
      conditionsArray.length > 0 ? conditionsArray.join(" AND ") : "1=1";
    return { sql, values };
  }
}
