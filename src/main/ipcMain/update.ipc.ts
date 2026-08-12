import { registerUpdateApi } from "@/main/core/apis/update.api";

/** 注册更新域 IPC 处理器（委托 core/apis/update.api） */
export function registerUpdateHandlers(): void {
  registerUpdateApi();
}
