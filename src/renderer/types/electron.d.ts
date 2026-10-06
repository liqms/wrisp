import type { ElectronAPI } from "@/main/preload/types";

// 单一事实来源：preload 暴露的 ElectronAPI（见 src/main/preload/types/index.ts）
export type { ElectronAPI };

// 扩展 Window 接口，将 electronAPI 添加到全局 window 对象
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }

  // Electron <webview> 标签类型声明
  interface HTMLElementTagNameMap {
    webview: Electron.WebviewTag;
  }
}