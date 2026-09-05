import { CharacterDao } from "@/main/core/db";
import type {
  Character,
  CharacterId,
  CharacterOwnerType,
} from "@/main/types/db";
import { Logger } from "@/main/utils/logger";

/** 人物归属：type=contact 时 id 必须为 null；type=project 时 id 为作品 ID */
export interface CharacterOwner {
  type: CharacterOwnerType;
  id?: string | null;
}

/**
 * 人物服务
 * 提供人物表查询与按「名称+归属」去重的批量写入（@人物提及同步）
 */
class CharacterService {
  private static instance: CharacterService | null = null;
  private characterDao: CharacterDao;

  private constructor() {
    this.characterDao = new CharacterDao();
  }

  /**
   * 获取 CharacterService 单例实例
   */
  public static getInstance(): CharacterService {
    if (!CharacterService.instance) {
      CharacterService.instance = new CharacterService();
    }
    return CharacterService.instance;
  }

  /**
   * 模糊查询人物（供编辑器 @ 建议下拉，全局搜索不过滤归属）
   * @param name 名称关键词
   * @param options.limit 最大返回条数（默认 8）
   */
  public findCharacters(
    name: string,
    options: { limit?: number } = {},
  ): Character[] {
    try {
      const { limit = 8 } = options;
      return this.characterDao.findByNameLike(name, limit);
    } catch (error) {
      Logger.error("查询人物失败", { error: String(error), name });
      throw error;
    }
  }

  /**
   * 按「名称+归属」批量写入人物（去重：入参去重 + 跳过已存在身份，事务内执行）
   * 同名人物归属不同作品可共存；归属内按名称唯一
   * @param names 人物名称数组
   * @param owner 人物归属（contact / project+作品ID）
   * @returns 人物 ID 数组（与去重后的名称一一对应）
   */
  public upsertByName(names: string[], owner: CharacterOwner): CharacterId[] {
    try {
      const unique = [
        ...new Set(names.map((n) => n.trim()).filter((n) => n !== "")),
      ];
      if (unique.length === 0) {
        return [];
      }
      const ownerType: CharacterOwnerType = owner.type;
      const ownerId = owner.type === "project" && owner.id ? owner.id : null;
      return this.characterDao.transaction(() => {
        const ids: CharacterId[] = [];
        for (const name of unique) {
          const existing = this.characterDao.findByIdentity(
            name,
            ownerType,
            ownerId,
          );
          if (existing) {
            ids.push(existing.id);
            continue;
          }
          ids.push(
            this.characterDao.create({
              name,
              owner_type: ownerType,
              owner_id: ownerId,
            }),
          );
        }
        return ids;
      });
    } catch (error) {
      Logger.error("批量写入人物失败", {
        error: String(error),
        names,
        owner,
      });
      throw error;
    }
  }
}

export const characterService = CharacterService.getInstance();
