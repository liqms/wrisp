import { ipcMain } from "electron";
import {
  getFile,
  upsertCustom,
  deleteCustom,
  setEnabled,
} from "@/main/core/apis/template.api";
import type { ApiResponse } from "@/shared/types";
import type { TemplateType } from "@/shared/enums/template.enums";
import type {
  CustomTemplate,
  TemplateFile,
} from "@/shared/types/template.types";

export function registerTemplateHandlers() {
  ipcMain.handle(
    "template:getFile",
    async (_, type: TemplateType): Promise<ApiResponse<TemplateFile>> => {
      return getFile(type);
    },
  );

  ipcMain.handle(
    "template:upsertCustom",
    async (
      _,
      type: TemplateType,
      tpl: CustomTemplate,
    ): Promise<ApiResponse<TemplateFile>> => {
      return upsertCustom(type, tpl);
    },
  );

  ipcMain.handle(
    "template:deleteCustom",
    async (
      _,
      type: TemplateType,
      id: string,
    ): Promise<ApiResponse<TemplateFile>> => {
      return deleteCustom(type, id);
    },
  );

  ipcMain.handle(
    "template:setEnabled",
    async (
      _,
      type: TemplateType,
      id: string,
      builtIn: boolean,
      enabled: boolean,
    ): Promise<ApiResponse<TemplateFile>> => {
      return setEnabled(type, id, builtIn, enabled);
    },
  );
}
