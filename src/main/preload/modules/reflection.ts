import { ipcRenderer } from "electron";
import type { ReflectionAPI } from "../types/reflection";

export const reflectionModule: ReflectionAPI = {
  reflection: {
    list: (params) => ipcRenderer.invoke("reflection:list", params),
    detail: (id) => ipcRenderer.invoke("reflection:detail", id),
  },
};