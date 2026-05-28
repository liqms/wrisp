/**
 * Electron IPC 监听器统一管理
 * 提供类型安全的监听注册、去重和清理机制
 */

/** 监听器注册记录 */
interface ListenerEntry {
  channel: string;
  callback: (data: any) => void;
}

/** 已注册的监听器映射（channel → entry），用于去重和清理 */
const registeredListeners = new Map<string, ListenerEntry>();

/**
 * 注册 IPC 监听器（全局去重，同一 channel 仅注册一次）
 * @param channel IPC 频道名
 * @param callback 数据回调
 */
export function onElectron(channel: string, callback: (data: any) => void): void {
  if (typeof window === "undefined" || !window.electronAPI) {
    return;
  }

  // 已注册则跳过
  if (registeredListeners.has(channel)) {
    return;
  }

  registeredListeners.set(channel, { channel, callback });
  window.electronAPI.on(channel, callback);
}

/**
 * 移除指定 IPC 监听器
 * @param channel IPC 频道名
 */
export function offElectron(channel: string): void {
  if (typeof window === "undefined" || !window.electronAPI) {
    return;
  }

  if (registeredListeners.has(channel)) {
    window.electronAPI.off(channel);
    registeredListeners.delete(channel);
  }
}

/**
 * 移除所有已注册的 IPC 监听器
 */
export function offAllElectron(): void {
  if (typeof window === "undefined" || !window.electronAPI) {
    return;
  }

  for (const channel of registeredListeners.keys()) {
    window.electronAPI.off(channel);
  }
  registeredListeners.clear();
}

/**
 * 检查指定频道是否已注册监听
 */
export function isListenerRegistered(channel: string): boolean {
  return registeredListeners.has(channel);
}
