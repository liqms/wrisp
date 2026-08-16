import { ipcRenderer } from "electron";
import type { TemplateAPI } from "../types/template";

export const templateModule: TemplateAPI = {
  getFile: () => ipcRenderer.invoke("template:getFile"),
  upsertCustom: (tpl) => ipcRenderer.invoke("template:upsertCustom", tpl),
  deleteCustom: (id) => ipcRenderer.invoke("template:deleteCustom", id),
  setEnabled: (id, builtIn, enabled) =>
    ipcRenderer.invoke("template:setEnabled", id, builtIn, enabled),
};
