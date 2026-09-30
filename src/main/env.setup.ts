import { app } from "electron";
import path from "path";
import { isDev } from "@/main/utils/env";

/**
 * 开发/生产环境数据隔离入口。
 * 必须在任何读取 userData 路径的模块之前执行（由 src/main/index.ts 首行导入）。
 * 开发环境下将 userData 重定向到 <原userData>-dev，使配置、日志、本地模型、缓存与生产环境隔离。
 */
if (isDev()) {
  const devUserData = app.getPath("userData") + "-dev";
  app.setPath("userData", devUserData);
  // 日志目录：macOS 默认固定为 ~/Library/Logs/<name>，需显式重定向以跨平台一致隔离
  app.setPath("logs", path.join(devUserData, "logs"));
}