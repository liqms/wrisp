import { ipcMain } from "electron";
import { findCharacters } from "@/main/core/apis/character.api";
import type { Character, ApiResponse } from "@/shared/types";

export function registerCharacterHandlers(): void {
  ipcMain.handle(
    "character:find",
    async (
      _,
      name: string,
      options?: { limit?: number },
    ): Promise<ApiResponse<Character[]>> => {
      return findCharacters(name, options);
    },
  );
}
