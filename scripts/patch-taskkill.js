/**
 * taskkill 容错补丁（预加载进 vite 子进程）
 *
 * 原因：vite-plugin-electron 在重启 Electron 时调用 treeKillSync ->
 *       execSync('taskkill /pid X /T /F')。如果旧进程已经自行退出，
 *       taskkill 会抛 "process not found" 错误，导致整个 vite 进程崩溃。
 *       此处对以 taskkill 开头的命令捕获错误并静默忽略
 *       （进程不存在本身就是我们想要的结果）。
 *
 * 通过 scripts/dev.js 以 NODE_OPTIONS=--require 注入到 vite 进程，
 * 使补丁在 vite-plugin-electron 所在进程中生效。
 */
const originalExecSync = require("child_process").execSync;
require("child_process").execSync = function patchedExecSync(
  command,
  options,
) {
  try {
    return originalExecSync.call(this, command, options);
  } catch (err) {
    const cmd =
      typeof command === "string" ? command.trim().toLowerCase() : "";
    if (cmd.startsWith("taskkill")) {
      // 进程不存在或已退出 -> 视为成功，返回空 Buffer
      return Buffer.alloc(0);
    }
    throw err;
  }
};
