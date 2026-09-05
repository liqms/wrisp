import { characterService } from "@/main/core/services/character.service";
import { response } from "@/main/utils/response";
import { ErrorCode } from "@/shared/enums";
import type { Character, ApiResponse } from "@/shared/types";
import { Logger } from "@/main/utils/logger";

/**
 * 模糊查询人物（编辑器 @ 建议下拉）
 */
async function findCharacters(
  name: string,
  options?: { limit?: number },
): Promise<ApiResponse<Character[]>> {
  try {
    const characters = characterService.findCharacters(name, options ?? {});
    return response.success(characters);
  } catch (error) {
    Logger.error("查询人物失败", { error: String(error), name, options });
    return response.error(ErrorCode.CHARACTER_QUERY_FAILED, error as Error);
  }
}

export { findCharacters };
