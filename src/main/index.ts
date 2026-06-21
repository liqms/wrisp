import { app, BrowserWindow, ipcMain, screen } from "electron";
import path from "path";
import { Logger } from "@/main/utils/logger";
import dotenv from "dotenv";
import { configService } from "@/main/core/services/config.service";
// import { Scheduler } from '@/main/core/scheduler'

// 设置控制台编码为 UTF-8（Windows 系统）
if (process.platform === "win32") {
  process.env.CHCP = "65001";
}

// 加载环境变量，指定 UTF-8 编码，禁用提示
dotenv.config({ encoding: "utf8", override: true });

import {
  registerWindowHandlers,
  registerConfigHandlers,
  registerSystemHandlers,
  registerLoggerHandlers,
  registerWebViewHandlers,
  registerCaptureHandlers,
  registerProjectHandlers,
  registerAIHandlers,
  registerSkillHandlers,
  registerModelHandlers,
  registerTagHandlers,
  registerPageHandlers,
  registerThinkHandlers,
  registerSmartTaskHandlers,
  registerTaskHandlers,
} from "@/main/ipcMain";
import { databaseMigration } from "@/main/core/migration";
import { setWorkspacePath } from "@/main/core/db/connection";
import { registerProtocolHandler } from "@/main/protocol";
import { skillManager } from "@/main/core/skills/skill.manager";
import { vectorService } from "@/main/core/services/vector.service";
import { taskQueue, taskExecutor } from "@/main/core/task-queue";
import { downloadService } from "@/main/core/services/download.service";
import { setupDownloadListeners } from "@/main/preload/listeners/download";

// 使用传统的 Node.js 路径处理方式
const __dirname = path.dirname(__filename || process.argv[1] || ".");

// 初始化 Logger
Logger.initialize();
// 清理过期日志文件
Logger.cleanupOldLogsAsync();

// 初始化数据库和数据库迁移
async function initializeDatabase(): Promise<void> {
  const workspacePath: string = configService.getValue("workspace") || "";
  if (!workspacePath || workspacePath.trim() === "") {
    return;
  }

  // 确保工作空间路径已同步到数据库连接模块，
  // 避免 ConfigService 尚未初始化时 getDbPath 无法获取路径
  setWorkspacePath(workspacePath);

  try {
    Logger.info("开始初始化数据库");

    const isInitialized = databaseMigration.isDatabaseInitialized();

    if (!isInitialized) {
      Logger.info("数据库未初始化，执行初始化");
      await databaseMigration.executeDatabaseMigration();
    } else {
      Logger.info("数据库已初始化，检查版本迁移");
      await databaseMigration.executeDatabaseMigration(
        process.env.SQLITE_DB_VERSION || "1.0.0",
      );
    }

    Logger.info("数据库初始化完成");
  } catch (error) {
    Logger.error("数据库初始化失败:", { error: String(error) });
    throw error;
  }
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  // 在开发模式下使用编译后的文件路径，生产模式下使用编译后路径
  const preloadPath = path.join(__dirname, "preload.js");

  const mainWindow = new BrowserWindow({
    width: width * 0.8,
    height: height * 0.8,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.NODE_ENV === "development") {
    const devViteUrl = `http://${process.env.DEV_VITE_HOST}:${process.env.DEV_VITE_PORT}`;
    Logger.info(`开发环境 VITE_URL: ${devViteUrl}`);
    mainWindow.loadURL(devViteUrl);
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, "..", "dist-renderer", "index.html");
    mainWindow.loadFile(indexPath);
  }
}

app.whenReady().then(async () => {
  await initializeDatabase();
  registerProtocolHandler();
  skillManager.initialize();

  // 恢复中断的任务队列
  await taskQueue.resetRunningTasks();

  // 检查是否有未完成的任务，需要用户确认续传
  const hasPendingTasks = taskQueue.countPending() > 0;
  if (hasPendingTasks) {
    Logger.info("[App] 发现未完成的任务，等待用户确认续传", {
      count: taskQueue.countPending(),
      summary: taskQueue.getPendingSummary(),
    });
  } else {
    // 无未完成任务，正常启动工作器
    taskExecutor.startWorkers(3);
  }

  // 注册模型下载任务处理器
  taskExecutor.registerHandler("model:download-file", async (task) => {
    const payload = typeof task.payload === "string" ? JSON.parse(task.payload) : task.payload;
    const { url, subDir, groupId, fileName } = payload ?? {};
    await downloadService.download(url, subDir, { groupId, fileName });
  });

  createWindow();
  registerWindowHandlers();
  registerConfigHandlers();
  registerSystemHandlers();
  registerLoggerHandlers();
  registerWebViewHandlers();
  registerCaptureHandlers();
  registerProjectHandlers();
  registerAIHandlers();
  registerSkillHandlers();
  registerModelHandlers();
  registerTagHandlers();
  registerPageHandlers();
  registerThinkHandlers();
  registerSmartTaskHandlers();
  registerTaskHandlers();

  // 启动下载事件监听（将 DownloadService 事件桥接到渲染进程）
  setupDownloadListeners();

  // 如果有待续传任务，发送到渲染进程让用户确认
  if (hasPendingTasks) {
    const summary = taskQueue.getPendingSummary();
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send("task:pending", summary);
    });

    // 监听用户确认/取消续传
    ipcMain.once("task:confirmResume", () => {
      Logger.info("[App] 用户确认续传任务");
      taskExecutor.startWorkers(3);
    });
    ipcMain.once("task:cancelResume", () => {
      Logger.info("[App] 用户取消续传任务");
    });
  }

  // 初始化向量数据库服务
  try {
    await vectorService.initialize();
  } catch (error) {
    Logger.error("向量数据库服务初始化失败", { error: String(error) });
  }

  // 初始化定时任务调度器
  // Scheduler.getInstance()
  // Logger.info('定时任务调度器已启动')

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
