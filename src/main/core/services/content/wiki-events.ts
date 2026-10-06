import { BrowserWindow } from "electron";
import { Logger } from "@/main/utils/logger";

/** 主进程 → 渲染层：Wiki 数据已变化（切分 / 智能整理等异步任务完成后广播） */
export const WIKI_UPDATED_CHANNEL = "wiki:updated";

/** 批量任务会密集触发，去抖合并为一次刷新通知（ms） */
const WIKI_UPDATED_DEBOUNCE_MS = 800;

let debounceTimer: NodeJS.Timeout | null = null;

/**
 * 通知渲染层 Wiki 数据已变化，触发概览 / 卡片列表重新拉取。
 * 用于切分、智能整理等异步任务完成后，避免界面数据停留在旧值。
 */
export function notifyWikiUpdated(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    try {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(WIKI_UPDATED_CHANNEL);
      }
    } catch (error) {
      Logger.warn("广播 Wiki 更新事件失败", { error: String(error) });
    }
  }, WIKI_UPDATED_DEBOUNCE_MS);
  // 不因待触发的通知而阻塞进程退出
  debounceTimer.unref();
}