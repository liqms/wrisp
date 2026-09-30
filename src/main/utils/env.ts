import { app } from "electron";

/**
 * 是否为开发环境
 * 打包发布（app.isPackaged === true）视为生产环境；开发（pnpm dev）视为开发环境。
 */
export function isDev(): boolean {
  return !app.isPackaged;
}