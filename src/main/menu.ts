import { Menu, BrowserWindow, clipboard } from "electron";
import { notificationService } from "@/main/core/services/notification.service";
import { configService } from "@/main/core/services/config.service";
import { LOCALE } from "@/shared/enums";

/**
 * 应用菜单设置
 * 提供编辑菜单（复制、粘贴）等全局快捷键操作
 */

/** 通知消息（双语） */
const messages = {
  copy: { [LOCALE.ZH]: "已复制", [LOCALE.EN]: "Copied" },
  paste: { [LOCALE.ZH]: "已粘贴", [LOCALE.EN]: "Pasted" },
  copyEmpty: { [LOCALE.ZH]: "没有选中文本", [LOCALE.EN]: "No text selected" },
  pasteEmpty: { [LOCALE.ZH]: "剪贴板为空", [LOCALE.EN]: "Clipboard is empty" },
};

/** 获取当前语言的消息 */
function getMessage(
  msg: Record<string, string>,
): string {
  const locale = configService.getValue("general.locale") || LOCALE.ZH;
  return msg[locale] || msg[LOCALE.ZH];
}

/** 获取目标窗口：优先使用菜单回调传入的窗口，回退到第一个窗口 */
function getTargetWindow(browserWindow?: BrowserWindow | null): BrowserWindow | null {
  if (browserWindow && !browserWindow.isDestroyed()) return browserWindow;
  const allWindows = BrowserWindow.getAllWindows();
  return allWindows.length > 0 ? allWindows[0] : null;
}

/**
 * 设置应用菜单
 * 包含编辑菜单：复制、粘贴
 */
export function setupMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "编辑",
      submenu: [
        {
          label: "复制",
          accelerator: "CmdOrCtrl+C",
          click: (_item, browserWindow) => {
            const win = getTargetWindow(browserWindow);
            if (win) {
              win.webContents.copy();
              notificationService.success(getMessage(messages.copy));
            }
          },
        },
        {
          label: "粘贴",
          accelerator: "CmdOrCtrl+V",
          click: (_item, browserWindow) => {
            const win = getTargetWindow(browserWindow);
            if (win) {
              const hasText = clipboard.availableFormats().includes("text/plain");
              if (!hasText) {
                notificationService.warning(getMessage(messages.pasteEmpty));
                return;
              }
              win.webContents.paste();
              notificationService.success(getMessage(messages.paste));
            }
          },
        },
        { type: "separator" },
        { role: "selectAll", label: "全选" },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
