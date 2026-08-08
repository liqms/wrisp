import { ipcRenderer } from "electron";
import type { ConceptAPI } from "../types/concept";

export const conceptModule: ConceptAPI = {
  concept: {
    list: (params) => ipcRenderer.invoke("concept:list", params),
    detail: (id) => ipcRenderer.invoke("concept:detail", id),
  },
  temporal: {
    list: (startDate?, endDate?) => ipcRenderer.invoke("concept:temporal:list", startDate, endDate),
  },
};