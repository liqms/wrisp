import { ipcMain } from "electron";
import {
  getFile,
  upsertCustom,
  deleteCustom,
  setEnabled,
} from "@/main/core/apis/template.api";
import type { ApiResponse } from "@/shared/types";
import type {
  CustomTemplate,
  SlashTemplateFile,
} from "@/shared/types/template.types";

export function registerTemplateHandlers() {
  ipcMain.handle(
    "template:getFile",
    async (): Promise<ApiResponse<SlashTemplateFile>> => {
      return getFile();
    },
  );

  ipcMain.handle(
    "template:upsertCustom",
    async (
      _,
      tpl: CustomTemplate,
    ): Promise<ApiResponse<SlashTemplateFile>> => {
      return upsertCustom(tpl);
    },
  );

  ipcMain.handle(
    "template:deleteCustom",
    async (_, id: string): Promise<ApiResponse<SlashTemplateFile>> => {
      return deleteCustom(id);
    },
  );

  ipcMain.handle(
    "template:setEnabled",
    async (
      _,
      id: string,
      builtIn: boolean,
      enabled: boolean,
    ): Promise<ApiResponse<SlashTemplateFile>> => {
      return setEnabled(id, builtIn, enabled);
    },
  );
}
