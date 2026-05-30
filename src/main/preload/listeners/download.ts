import { BrowserWindow } from "electron";
import { downloadService } from "@/main/core/services/download.service";
import type { DownloadProgress } from "@/main/types/download.types";

export function setupDownloadListeners(): void {
  downloadService.on("progress", (progress: DownloadProgress) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      try {
        win.webContents.send("download:progress", progress);
      } catch (e) {
        // 忽略发送失败的窗口
      }
    });
  });

  downloadService.on("complete", (taskId: string, localPath: string) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      try {
        win.webContents.send("download:complete", { taskId, localPath });
      } catch (e) {
        // 忽略发送失败的窗口
      }
    });
  });

  downloadService.on("error", (taskId: string, error: string) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      try {
        win.webContents.send("download:error", { taskId, error });
      } catch (e) {
        // 忽略发送失败的窗口
      }
    });
  });
}
