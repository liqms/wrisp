import type { Character, ApiResponse } from "@/shared/types";

export interface CharacterAPI {
  findCharacters(
    name: string,
    options?: { limit?: number },
  ): Promise<ApiResponse<Character[]>>;
}
