import { ipcRenderer } from "electron";
import type { PageAPI } from "../types/page";

export const pageModule: PageAPI = {
  get: (id: string) => ipcRenderer.invoke("page:get", id),
  paginate: (params) => ipcRenderer.invoke("page:paginate", params),
  getTree: (projectId: string) =>
    ipcRenderer.invoke("page:getTree", projectId),
  create: (data) => ipcRenderer.invoke("page:create", data),
  update: (id: string, data) => ipcRenderer.invoke("page:update", id, data),
  delete: (id: string) => ipcRenderer.invoke("page:delete", id),
};
