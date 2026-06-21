import { BaseDao } from "./base.dao";
import {
  Project,
  ProjectCreate,
  ProjectUpdate,
  ProjectId,
  Name,
  ProjectDetail,
  TagId,
} from "@/main/types/db";
import { PaginationResult } from "@/shared/utils/pagination";
import { TimeUtil } from "@/shared/utils";

export class ProjectDao extends BaseDao<Project, ProjectCreate, ProjectUpdate> {
  constructor() {
    super("projects");
  }

  findByTypeAndTagIds(type?: string, tagIds?: string[]): Project[] {
    const conditions: string[] = ["p.status = 'active'"];
    const params: unknown[] = [];

    if (type) {
      conditions.push("p.type = ?");
      params.push(type);
    }

    if (tagIds && tagIds.length > 0) {
      const placeholders = tagIds.map(() => "?").join(",");
      conditions.push(`ti.entity_type = 'project' AND ti.tag_id IN (${placeholders})`);
      params.push(...tagIds);
    }

    if (tagIds && tagIds.length > 0) {
      const whereClause = `WHERE ${conditions.join(" AND ")}`;
      const sql = `
        SELECT DISTINCT p.*
        FROM ${this.tableName} p
        JOIN tagged_items ti ON p.id = ti.entity_id
        ${whereClause}
        ORDER BY p.created_at DESC
      `;
      return this.query(sql, params);
    } else if (type) {
      const whereClause = `WHERE ${conditions.join(" AND ")}`;
      const sql = `SELECT * FROM ${this.tableName} ${whereClause} ORDER BY created_at DESC`;
      return this.query(sql, params);
    }

    return [];
  }

  findDetail(id: ProjectId): ProjectDetail | null {
    const sql = `
      SELECT p.*,
        COALESCE(pb.block_count, 0) AS block_count,
        COALESCE(pg.page_count, 0) AS page_count,
        COALESCE(GROUP_CONCAT(t.id || '|' || t.name || '|' || t.color || '|' || t.description, ';;'), '') AS tags_data
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
      LEFT JOIN tagged_items ti ON p.id = ti.entity_id AND ti.entity_type = 'project'
      LEFT JOIN tags t ON ti.tag_id = t.id
      WHERE p.id = ? AND p.status = 'active'
      GROUP BY p.id
    `;

    const result = this.queryOne(sql, [id]) as (ProjectDetail & { tags_data: string }) | null;
    if (result) {
      return this.parseTags(result);
    }
    return null;
  }

  private parseTags(result: ProjectDetail & { tags_data: string }): ProjectDetail {
    const { tags_data, ...project } = result;
    const tags: typeof project.tags = tags_data ?
      tags_data.split(';;').map(tagStr => {
        const [id, name, color, description] = tagStr.split('|');
        return { id, name, color, description, created_at: '', updated_at: '' };
      }) : undefined;
    return { ...project, tags };
  }

  findByNameLike(name: string): Project[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE name LIKE ? AND status = 'active' ORDER BY name ASC`;
    return this.query(sql, [`%${name}%`]);
  }

  findAllDetail(): ProjectDetail[] {
    const sql = `
      SELECT p.*,
        COALESCE(pb.block_count, 0) AS block_count,
        COALESCE(pg.page_count, 0) AS page_count,
        COALESCE(GROUP_CONCAT(t.id || '|' || t.name || '|' || t.color || '|' || t.description, ';;'), '') AS tags_data
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
      LEFT JOIN tagged_items ti ON p.id = ti.entity_id AND ti.entity_type = 'project'
      LEFT JOIN tags t ON ti.tag_id = t.id
      WHERE p.status = 'active'
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `;
    const results = this.query(sql) as (ProjectDetail & { tags_data: string })[];
    return results.map(this.parseTags.bind(this));
  }

  /**
   * 分页查询作品详情（含统计和标签）
   * @param params.page 页码（从 1 开始），默认 1
   * @param params.pageSize 每页记录数，默认 50
   * @param params.orderBy 排序字段，默认 'created_at'
   * @param params.orderDir 排序方向，默认 'ASC'
   * @param params.conditions 查询条件
   * @returns 分页结果
   */
  paginateDetail(
    params: {
      page?: number;
      pageSize?: number;
      orderBy?: string;
      orderDir?: "ASC" | "DESC";
      conditions?: Record<string, unknown>;
    } = {},
  ): PaginationResult<ProjectDetail> {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(Math.max(1, params.pageSize || 50), 100);
    const orderBy = this.sanitizeOrderBy(params.orderBy || "created_at");
    const safeOrderDir = params.orderDir?.toUpperCase() === "DESC" ? "DESC" : "ASC";

    const offset = (page - 1) * pageSize;

    let whereClause = "";
    const values: unknown[] = [];

    if (params.conditions && Object.keys(params.conditions).length > 0) {
      const built = this.buildWhereClause(params.conditions);
      whereClause = `WHERE ${built.sql}`;
      values.push(...built.values);
    }

    // Count total
    const countSql = `
      SELECT COUNT(*) AS count
      FROM (
        SELECT p.id
        FROM ${this.tableName} p
        LEFT JOIN tagged_items ti ON p.id = ti.entity_id AND ti.entity_type = 'project'
        LEFT JOIN tags t ON ti.tag_id = t.id
        ${whereClause}
        GROUP BY p.id
      )
    `;
    const countResult = this.query(countSql, values);
    const total = countResult.length > 0 ? (countResult[0] as unknown as { count: number }).count : 0;

    // Query detail data with pagination
    const dataSql = `
      SELECT p.*,
        COALESCE(pb.block_count, 0) AS block_count,
        COALESCE(pg.page_count, 0) AS page_count,
        COALESCE(GROUP_CONCAT(t.id || '|' || t.name || '|' || t.color || '|' || t.description, ';;'), '') AS tags_data
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
      LEFT JOIN tagged_items ti ON p.id = ti.entity_id AND ti.entity_type = 'project'
      LEFT JOIN tags t ON ti.tag_id = t.id
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.${orderBy} ${safeOrderDir}
      LIMIT ? OFFSET ?
    `;
    const results = this.query(dataSql, [...values, pageSize, offset]) as (ProjectDetail & { tags_data: string })[];

    const data = results.map(this.parseTags.bind(this));

    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      startIndex: (page - 1) * pageSize,
      endIndex: Math.min((page - 1) * pageSize + pageSize, total),
    };
  }

  saveTags(projectId: ProjectId, tagIds: TagId[]): void {
    const timestamp = TimeUtil.toISOString(Date.now());
    this.transaction(() => {
      this.execute("DELETE FROM tagged_items WHERE entity_type = 'project' AND entity_id = ?", [projectId]);
      for (const tagId of tagIds) {
        this.execute(
          "INSERT OR IGNORE INTO tagged_items (tag_id, entity_type, entity_id, added_at) VALUES (?, 'project', ?, ?)",
          [tagId, projectId, timestamp],
        );
      }
    });
  }

  clearTags(projectId: ProjectId): void {
    this.execute("DELETE FROM tagged_items WHERE entity_type = 'project' AND entity_id = ?", [projectId]);
  }

  checkNameExists(name: Name, excludeId?: ProjectId): boolean {
    const excludeClause = excludeId ? " AND id != ?" : "";
    const sql = `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE name = ? AND status = 'active'${excludeClause}) as "exists"`;
    const params: unknown[] = excludeId ? [name, excludeId] : [name];

    const stmt = this.db.prepare(sql);
    const result = stmt.get(params) as { exists: number };
    return result?.exists === 1;
  }
}


