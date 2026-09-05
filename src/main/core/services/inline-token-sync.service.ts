import { characterService } from "@/main/core/services/character.service";
import type { CharacterOwner } from "@/main/core/services/character.service";
import { tagService } from "@/main/core/services/tag.service";
import {
  extractTagNames,
  extractCharacterNames,
} from "@/shared/utils/text-tokens";
import { Logger } from "@/main/utils/logger";

/**
 * 行内 token 同步服务：文档保存时解析 markdown，
 * 将 #标签 同步进标签表（按名称去重）、@人物 同步进人物表（按名称+归属去重）。
 * 同步失败仅记录日志，不阻断文档保存。
 */
class InlineTokenSyncService {
  private static instance: InlineTokenSyncService | null = null;

  private constructor() {}

  /**
   * 获取 InlineTokenSyncService 单例实例
   */
  public static getInstance(): InlineTokenSyncService {
    if (!InlineTokenSyncService.instance) {
      InlineTokenSyncService.instance = new InlineTokenSyncService();
    }
    return InlineTokenSyncService.instance;
  }

  /**
   * 解析 markdown 并同步 #标签 / @人物 入库
   * @param markdown 文档内容
   * @param owner @人物的归属：日志传 { type: 'contact' }；
   *              作品页面传 { type: 'project', id: page.project_id }（无 project_id 时传 contact）
   */
  public syncFromMarkdown(markdown: string, owner: CharacterOwner): void {
    if (!markdown || markdown.trim() === "") {
      return;
    }
    try {
      const tagNames = extractTagNames(markdown);
      if (tagNames.length > 0) {
        tagService.createTags(tagNames.map((name) => ({ name })));
      }

      const characterNames = extractCharacterNames(markdown);
      if (characterNames.length > 0) {
        characterService.upsertByName(characterNames, owner);
      }
    } catch (error) {
      Logger.error("同步行内标签/人物失败", { error: String(error) });
    }
  }
}

export const inlineTokenSyncService = InlineTokenSyncService.getInstance();
