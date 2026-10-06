import { app } from "electron";
import path from "path";
import { DEV_WORKSPACE_SUFFIX } from "@/main/constants/folder.constants";

/**
 * 是否为开发环境
 * 打包发布（app.isPackaged === true）视为生产环境；开发（pnpm dev）视为开发环境。
 */
export function isDev(): boolean {
  return !app.isPackaged;
}

/**
 * 开发/生产环境数据隔离：把 userData 重定向到 <appData>/<name>-dev，
 * 使配置、日志、本地模型、缓存与生产环境隔离。
 *
 * 之所以写成模块顶层副作用、而不是靠入口首行的导入顺序：主进程入口会被 Rollup 代码分割，
 * 共享 chunk 的 require 提升到入口体之前，config.service 的模块级单例（读取 userData）
 * 因此早于入口内任何语句执行。改为挂在 env.ts 上后，由 chunk 内的依赖拓扑序
 * （env.ts ← config.service）保证本副作用先于所有读取 userData 的模块执行。
 *
 * 目标路径由 appData 推导，而非在当前 userData 上追加后缀，故重复执行不会叠出 -dev-dev。
 *
 * 只在具备完整路径 API 的 Electron 主进程上下文执行：worker_threads、以及单元测试里的
 * electron mock 常常缺 getName / setPath，缺方法时跳过重定向而不是让模块加载失败。
 */
if (
  isDev() &&
  typeof app.getPath === "function" &&
  typeof app.getName === "function" &&
  typeof app.setPath === "function"
) {
  const devUserData = path.join(app.getPath("appData"), `${app.getName()}${DEV_WORKSPACE_SUFFIX}`);
  if (app.getPath("userData") !== devUserData) {
    app.setPath("userData", devUserData);
  }
  // 日志目录：macOS 默认固定为 ~/Library/Logs/<name>，需显式重定向以跨平台一致隔离
  app.setPath("logs", path.join(devUserData, "logs"));
}
