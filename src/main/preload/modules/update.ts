import { ipcRenderer } from "electron";
import type { UpdateAPI } from "@/main/preload/types/update";

/** 更新域预加载模块 */
export const updateModule: UpdateAPI = {
  check: () => ipcRenderer.invoke("update:check") as Promise<boolean>,
  download: () => ipcRenderer.invoke("update:download") as Promise<void>,
  install: () => ipcRenderer.invoke("update:install") as void,
  onEvent(event, listener) {
    const channel = `update:${event}`;
    ipcRenderer.on(channel, (_event, payload) => listener(payload));
  },
};
