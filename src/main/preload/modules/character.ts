import { ipcRenderer } from "electron";
import type { CharacterAPI } from "../types/character";
import type { Character, ApiResponse } from "@/shared/types";

export const characterModule: CharacterAPI = {
  findCharacters: (name, options) =>
    ipcRenderer.invoke("character:find", name, options) as Promise<
      ApiResponse<Character[]>
    >,
};
