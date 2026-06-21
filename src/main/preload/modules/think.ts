import { ipcRenderer } from "electron";
import type { ThinkAPI } from "../types/think";

export const thinkModule: ThinkAPI = {
  concept: {
    list: (params) => ipcRenderer.invoke("think:concept:list", params),
    detail: (id) => ipcRenderer.invoke("think:concept:detail", id),
  },
  topic: {
    list: (params) => ipcRenderer.invoke("think:topic:list", params),
    detail: (id) => ipcRenderer.invoke("think:topic:detail", id),
  },
  reflection: {
    list: (params) => ipcRenderer.invoke("think:reflection:list", params),
    detail: (id) => ipcRenderer.invoke("think:reflection:detail", id),
  },
  temporal: {
    list: (startDate?, endDate?) => ipcRenderer.invoke("think:temporal:list", startDate, endDate),
  },
};