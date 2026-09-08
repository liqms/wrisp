import { ipcMain } from "electron";
import {
  getFile,
  upsertCustom,
  deleteCustom,
  setEnabled,
  getBuiltIn,
  getMarketplace,
  installMarketplace,
  uninstallMarketplace,
} from "@/main/core/apis/template.api";
import type { ApiResponse } from "@/shared/types";
import type { TemplateType } from "@/shared/enums/template.enums";
import type { ResourceType } from "@/shared/enums/resource.enums";
import type {
  CustomTemplate,
  TemplateFile,
  TemplateResourceFile,
} from "@/shared/types/template.types";
import type {
  MarketplaceCatalog,
  MarketplaceItem,
} from "@/shared/types/template.types";

export function registerTemplateHandlers() {
  ipcMain.handle(
    "template:getFile",
    async (_, type: TemplateType): Promise<ApiResponse<TemplateFile>> => {
      return getFile(type);
    },
  );

  ipcMain.handle(
    "template:getBuiltIn",
    async (
      _,
      type: TemplateType,
    ): Promise<ApiResponse<TemplateResourceFile[]>> => {
      return getBuiltIn(type);
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

  ipcMain.handle(
    "template:getMarketplace",
    async (
      _,
      type: ResourceType,
      force?: boolean,
    ): Promise<ApiResponse<MarketplaceCatalog>> => {
      return getMarketplace(type, force);
    },
  );

  ipcMain.handle(
    "template:installMarketplace",
    async (
      _,
      type: ResourceType,
      id: string,
    ): Promise<ApiResponse<MarketplaceItem>> => {
      return installMarketplace(type, id);
    },
  );

  ipcMain.handle(
    "template:uninstallMarketplace",
    async (
      _,
      type: ResourceType,
      id: string,
    ): Promise<ApiResponse<MarketplaceItem>> => {
      return uninstallMarketplace(type, id);
    },
  );
}
