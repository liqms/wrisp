import { ipcRenderer } from "electron";
import type { SmartTaskSnapshot } from "@/shared/types";
import type { SmartTaskAPI } from "../types/smart-task";

export const smartTaskModule: SmartTaskAPI = {
  start: () => ipcRenderer.invoke("smart-task:start"),
  cancel: () => ipcRenderer.invoke("smart-task:cancel"),
  pause: () => ipcRenderer.invoke("smart-task:pause"),
  resume: () => ipcRenderer.invoke("smart-task:resume"),
  getStatus: () => ipcRenderer.invoke("smart-task:status"),
  getHistory: () => ipcRenderer.invoke("smart-task:history"),
  onSnapshot: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: SmartTaskSnapshot) =>
      callback(snapshot);
    ipcRenderer.on("smart-task:snapshot", listener);
    return () => {
      ipcRenderer.removeListener("smart-task:snapshot", listener);
    };
  },
};