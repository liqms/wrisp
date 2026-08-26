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
  TemplateFile,
} from "@/shared/types/template.types";

export function registerTemplateHandlers() {
  ipcMain.handle(
    "template:getFile",
    async (): Promise<ApiResponse<TemplateFile>> => {
      return getFile();
    },
  );

  ipcMain.handle(
    "template:upsertCustom",
    async (
      _,
      tpl: CustomTemplate,
    ): Promise<ApiResponse<TemplateFile>> => {
      return upsertCustom(tpl);
    },
  );

  ipcMain.handle(
    "template:deleteCustom",
    async (_, id: string): Promise<ApiResponse<TemplateFile>> => {
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
    ): Promise<ApiResponse<TemplateFile>> => {
      return setEnabled(id, builtIn, enabled);
    },
  );
}
