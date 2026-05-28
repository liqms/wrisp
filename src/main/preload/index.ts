import { contextBridge, ipcRenderer } from "electron";
import { modules } from "./modules";
import { notificationManager } from "./listeners/notification";
import type { ElectronAPI } from "./types";

// 追踪 ipcRenderer.on 的包裹函数，用于 off 时移除
const listenerWrappers = new Map<
  string,
  (event: Electron.IpcRendererEvent, ...args: any[]) => void
>();

// 创建通用 IPC 方法
const genericIPC = {
  send: (channel: string, data: any) => {
    ipcRenderer.send(channel, data);
  },
  on: (channel: string, callback: (data: any) => void) => {
    const wrapper = (_: Electron.IpcRendererEvent, data: any) => callback(data);
    listenerWrappers.set(channel, wrapper);
    ipcRenderer.on(channel, wrapper);
  },
  off: (channel: string) => {
    const wrapper = listenerWrappers.get(channel);
    if (wrapper) {
      ipcRenderer.removeListener(channel, wrapper);
      listenerWrappers.delete(channel);
    }
  },
};

// 组合完整的 Electron API
const electronAPI: ElectronAPI = {
  ...modules,
  ...genericIPC,
  onNotification: (callback) => notificationManager.addListener(callback),
  removeNotificationListener: () => notificationManager.removeAllListeners(),
};

// 将 Electron API 暴露给渲染进程
contextBridge.exposeInMainWorld("electronAPI", electronAPI);

export { electronAPI };
export type { ElectronAPI } from "./types";
