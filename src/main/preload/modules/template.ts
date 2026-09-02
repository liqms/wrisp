import { ipcRenderer } from "electron";
import type { TemplateAPI } from "../types/template";

export const templateModule: TemplateAPI = {
  getFile: (type) => ipcRenderer.invoke("template:getFile", type),
  getBuiltIn: (type) => ipcRenderer.invoke("template:getBuiltIn", type),
  upsertCustom: (type, tpl) =>
    ipcRenderer.invoke("template:upsertCustom", type, tpl),
  deleteCustom: (type, id) =>
    ipcRenderer.invoke("template:deleteCustom", type, id),
  setEnabled: (type, id, builtIn, enabled) =>
    ipcRenderer.invoke("template:setEnabled", type, id, builtIn, enabled),
};
