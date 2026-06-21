import { ipcRenderer } from "electron";
import type { AIAPI } from "../types/ai";

export const aiModule: AIAPI = {
  chatCompletion: (request) => ipcRenderer.invoke("ai:chatCompletion", request),
  getCostSummary: () => ipcRenderer.invoke("ai:getCostSummary"),
  getCostRecords: (count?) => ipcRenderer.invoke("ai:getCostRecords", count),
  getProviders: () => ipcRenderer.invoke("ai:getProviders"),
  testProviderConnection: (providerId) => ipcRenderer.invoke("ai:testProviderConnection", providerId),
  refreshConfig: () => ipcRenderer.invoke("ai:refreshConfig"),
  isLocalAvailable: () => ipcRenderer.invoke("ai:localAvailable"),
  isCloudAvailable: () => ipcRenderer.invoke("ai:cloudAvailable"),
  getRouteStatus: () => ipcRenderer.invoke("ai:routeStatus"),
};