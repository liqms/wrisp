import { BaseDao } from "./base.dao";
import {
  Character,
  CharacterCreate,
  CharacterUpdate,
  CharacterOwnerType,
  Name,
} from "@/main/types/db";

export class CharacterDao extends BaseDao<
  Character,
  CharacterCreate,
  CharacterUpdate
> {
  constructor() {
    super("characters");
  }

  /**
   * 按身份查询人物（名称 + 归属），与 idx_characters_identity 唯一索引的表达式一致
   * @param name 人物名称
   * @param ownerType 归属类型（contact/project）
   * @param ownerId 归属作品 ID（contact 时传 null）
   */
  findByIdentity(
    name: Name,
    ownerType: CharacterOwnerType,
    ownerId: string | null,
  ): Character | null {
    const sql = `SELECT * FROM ${this.tableName} WHERE name = ? AND owner_type = ? AND COALESCE(owner_id, '') = ?`;
    // better-sqlite3 的 stmt.get() 无匹配时返回 undefined，规范化为 null
    return this.queryOne(sql, [name, ownerType, ownerId ?? ""]) ?? null;
  }

  /**
   * 根据名称模糊查询人物列表（全局搜索，供 @ 建议下拉）
   * @param name 名称关键词（自动转义 LIKE 通配符）
   * @param limit 最大返回条数（默认 50）
   */
  findByNameLike(name: string, limit: number = 50): Character[] {
    // 转义 LIKE 通配符 %、_ 及反斜杠
    const escaped = name.replace(/[\\%_]/g, "\\$&");
    const sql = `SELECT * FROM ${this.tableName} WHERE name LIKE ? ESCAPE '\\' ORDER BY name ASC LIMIT ?`;
    return this.query(sql, [`%${escaped}%`, limit]);
  }
}
