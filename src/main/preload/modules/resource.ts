import { ipcRenderer } from "electron";
import type { ResourceAPI } from "../types/resource";
import type { ResourceType } from "@/shared/enums/resource.enums";

export const resourceModule: ResourceAPI = {
  syncStatus: () => ipcRenderer.invoke("resource:syncStatus"),
  syncNow: () => ipcRenderer.invoke("resource:syncNow"),
  onUpdated: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, changedTypes: ResourceType[]) => callback(changedTypes);
    ipcRenderer.on("resource:updated", listener);
    return () => { ipcRenderer.removeListener("resource:updated", listener); };
  },
};
