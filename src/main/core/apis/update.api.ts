import { ipcMain, BrowserWindow } from "electron";
import { updateService } from "@/main/core/services/update.service";

/** 将更新事件转发到所有窗口的渲染进程 */
function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}

/** 更新域 API 注册 */
export function registerUpdateApi(): void {
  // 事件桥：主进程 -> 渲染进程
  updateService.onEvents({
    onAvailable: (info) => broadcast("update:available", info),
    onDownloadProgress: (progress) => broadcast("update:download-progress", progress),
    onDownloaded: (path) => broadcast("update:downloaded", path),
    onError: (message) => broadcast("update:error", message),
  });

  // 渲染进程 -> 主进程
  ipcMain.handle("update:check", async (): Promise<boolean> => {
    return updateService.check();
  });

  ipcMain.handle("update:download", async (): Promise<void> => {
    await updateService.download();
  });

  ipcMain.handle("update:install", (): void => {
    updateService.install();
  });
}
