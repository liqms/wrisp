import { ipcRenderer } from "electron";
import type { ProjectAPI } from "../types/project";

export const projectModule: ProjectAPI = {
  get: (id: string) => ipcRenderer.invoke("project:get", id),
  paginate: (params) => ipcRenderer.invoke("project:paginate", params),
  create: (data) => ipcRenderer.invoke("project:create", data),
  update: (id: string, data) => ipcRenderer.invoke("project:update", id, data),
  delete: (id: string) => ipcRenderer.invoke("project:delete", id),
  checkNameExists: (name: string, excludeId?: string) =>
    ipcRenderer.invoke("project:checkNameExists", name, excludeId),
};
