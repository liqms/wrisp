import { ipcRenderer } from "electron";
import type { PageAPI } from "../types/page";
import type { PageType } from "@/shared/enums";

export const pageModule: PageAPI = {
  get: (id: string) => ipcRenderer.invoke("page:get", id),
  paginate: (params) => ipcRenderer.invoke("page:paginate", params),
  getTree: (projectId: string, pageType: PageType) =>
    ipcRenderer.invoke("page:getTree", projectId, pageType),
  create: (data) => ipcRenderer.invoke("page:create", data),
  update: (data) => ipcRenderer.invoke("page:update", data),
  delete: (id: string) => ipcRenderer.invoke("page:delete", id),
};
