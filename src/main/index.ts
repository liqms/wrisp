import "@/main/utils/env";

import { app, BrowserWindow, Menu, ipcMain } from "electron";
import path from "path";
import { Logger } from "@/main/utils/logger";
import dotenv from "dotenv";
import { configService } from "@/main/core/services/system/config.service";
import { windowService } from "@/main/core/services/system/window.service";
import { scheduler } from '@/main/core/scheduler'
import { BackupTask } from '@/main/core/scheduler/backup.task'
import { DIST_RENDERER_DIR } from "@/main/constants";

// 调试：开启远程调试端口（Chrome DevTools Protocol）
app.commandLine.appendSwitch("remote-debugging-port", "9223");

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
  registerJournalHandlers,
  registerProjectHandlers,
  registerAIHandlers,
  registerSkillHandlers,
  registerModelHandlers,
  registerTagHandlers,
  registerCharacterHandlers,
  registerPageHandlers,
  registerConceptHandlers,
  registerTopicHandlers,
  registerWikiHandlers,
  registerReflectionHandlers,
  registerSmartTaskHandlers,
  registerTaskHandlers,
  registerSearchHandlers,
  registerUpdateHandlers,
  registerTemplateHandlers,
  registerAttachmentHandlers,
  registerResourceHandlers,
} from "@/main/ipcMain";
import { databaseMigration } from "@/main/core/migration";
import { setWorkspacePath } from "@/main/core/db/connection";
import { registerProtocolHandler } from "@/main/protocol";
import { skillManager } from "@/main/core/skills/skill.manager";
import { vectorService } from "@/main/core/services/ai/vector.service";
import { modelService } from "@/main/core/services/ai/model.service";
import { localAiManager } from "@/main/core/model-gateway/local-gateway";
import { setSmartTaskConfig } from "@/main/core/smart-tasks/smart-task.config";
import { trayService } from "@/main/core/services/system/tray.service";
import { taskQueue, taskExecutor } from "@/main/core/task-queue";
import { downloadService } from "@/main/core/services/system/download.service";
import { chunkIndexService } from "@/main/core/services/content/chunk-index.service";
import { setupDownloadListeners } from "@/main/preload/listeners/download";
import { workspaceInitService } from "@/main/core/services/base/workspace-init.service";
import { resourceSyncService } from "@/main/core/services/resource/resource-sync.service";

// 使用传统的 Node.js 路径处理方式
const __dirname = path.dirname(__filename || process.argv[1] || ".");

// 应用退出标志，用于区分窗口关闭和程序退出
let isAppQuitting = false

// 初始化 Logger
Logger.initialize();

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

    // 迁移主循环不在事务内（database.migration.ts 逐条 db.exec），半途失败无回滚，
    // 因此跨版本迁移前先落一份数据库备份。放在打开连接之前，避免复制到半写状态的 WAL。
    const versionBeforeMigration = databaseMigration.getDatabaseVersion();
    // 目标版本从迁移文件/待执行迁移记录派生；未初始化时 executeDatabaseMigration 内部会先建表
    const targetVersion = databaseMigration.getTargetVersion();
    if (versionBeforeMigration && versionBeforeMigration !== targetVersion) {
      Logger.info("检测到数据库版本变更，迁移前先备份", {
        from: versionBeforeMigration,
        to: targetVersion,
      });
      const backedUp = await BackupTask.getInstance().performBackup();
      // performBackup 内部已捕获异常，失败只记录不阻断：拒绝启动会把用户锁在损坏的库前
      if (!backedUp) {
        Logger.warn("迁移前备份失败，仍继续执行迁移");
      }
    }
    await databaseMigration.executeDatabaseMigration(targetVersion);

    // 幂等补齐旧库缺失的 schema 字段
    databaseMigration.ensureProjectPinnedColumn();
    databaseMigration.ensurePageTypeColumn();
    databaseMigration.ensureChunkVectorizedColumn();
    // chunk-summary 的专用标记：补列同时把已摘要的块回填为自身 updated_at，避免老库升级后整库重烧
    databaseMigration.ensureChunkSummaryStageColumn();

    // 幂等修复历史数据：pages.status 被旧版 updatePage 写为 NULL 的记录
    databaseMigration.repairPagesNullStatus();

    // 幂等移除 pages 表遗留的 is_container 字段（v1 容器页设计，已废弃）
    databaseMigration.dropPagesContainerColumn();

    // 幂等补齐 pages 的页面级分阶段标记列（须在 rebuild 表的 dropPagesContainerColumn 之后）
    databaseMigration.ensurePageStageColumns();

    // 跨越 0.5.0 时重建概念：合并同义概念并清空抽取标记（一次性，非每轮启动）
    databaseMigration.applyConceptDedupMigration(versionBeforeMigration);

    Logger.info("数据库初始化完成");
  } catch (error) {
    Logger.error("数据库初始化失败:", { error: String(error) });
    throw error;
  }
}

function createWindow(): BrowserWindow {
  const { width, height } = windowService.getInitialSize();

  // 在开发模式下使用编译后的文件路径，生产模式下使用编译后路径
  const preloadPath = path.join(__dirname, "preload.js");

  const mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // 关闭窗口时隐藏到系统托盘而非退出应用
  mainWindow.on('close', (event) => {
    if (!isAppQuitting && trayService.isInitialized()) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  // 窗口大小变化时保存到配置文件
  mainWindow.on('resize', () => {
    const [winWidth, winHeight] = mainWindow.getSize()
    windowService.saveWindowSize({ width: winWidth, height: winHeight })
  })

  if (!app.isPackaged) {
    const devViteUrl = `http://${process.env.DEV_VITE_HOST}:${process.env.DEV_VITE_PORT}`;
    Logger.info(`开发环境 VITE_URL: ${devViteUrl}`);
    mainWindow.loadURL(devViteUrl);
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, "..", DIST_RENDERER_DIR, "index.html");
    mainWindow.loadFile(indexPath);
  }

  return mainWindow
}

app.whenReady().then(async () => {
  await initializeDatabase();
  // 幂等补齐工作空间目录结构（sqlite + attachments/images + attachments/files）
  await workspaceInitService.ensureWorkspace();
  registerProtocolHandler();
  skillManager.initialize();

  // 本地 LLM 的 GPU 开关来自模型配置；manager 不反向依赖配置服务，故启动时推入一次
  localAiManager.setGpuAccelerationEnabled(
    modelService.getConfig().enableGpuAcceleration === true,
  );

  // 智能整理的调参同理：执行器只读进程内快照，由启动流程与配置写入路径推入。
  // 线程预算同时下发给本地网关（与 GPU 开关一样，下一次模型加载才生效）
  const { smartTask } = configService.getConfig();
  setSmartTaskConfig(smartTask);
  localAiManager.setThreadBudget({
    onnx: smartTask?.onnxIntraOpThreads ?? null,
    llm: smartTask?.llmMaxThreads ?? null,
  });

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

  // 注册文件切分任务处理器（保存 → 静默合并 → 异步切分语义块）
  taskExecutor.registerHandler("file:chunk", async (task) => {
    const payload = typeof task.payload === "string" ? JSON.parse(task.payload) : task.payload;
    const { fileId, fileHash, chunkType, projectId } = payload ?? {};
    await chunkIndexService.processFile(fileId, fileHash, chunkType, projectId);
  });

  // 注册 L3 语义精修处理器（仅在本地嵌入模型可用时改切分边界，失败保留 L2 结果）
  taskExecutor.registerHandler("file:chunk-refine", async (task) => {
    const payload = typeof task.payload === "string" ? JSON.parse(task.payload) : task.payload;
    const { fileId, fileHash, chunkType, projectId } = payload ?? {};
    await chunkIndexService.processRefine(fileId, fileHash, chunkType, projectId);
  });

  // 注册日志条目切块处理器（条目化：按日聚合脏条目，逐条 entry_id 差异同步）
  taskExecutor.registerHandler("journal:chunk-day", async (task) => {
    const payload = typeof task.payload === "string" ? JSON.parse(task.payload) : task.payload;
    const { date } = payload ?? {};
    await chunkIndexService.processJournalDay(date);
  });

  createWindow();
  Menu.setApplicationMenu(null);
  trayService.initialize();
  registerWindowHandlers();
  registerConfigHandlers();
  registerSystemHandlers();
  registerLoggerHandlers();
  registerWebViewHandlers();
  registerJournalHandlers();
  registerProjectHandlers();
  registerAIHandlers();
  registerSkillHandlers();
  registerModelHandlers();
  registerTagHandlers();
  registerCharacterHandlers();
  registerPageHandlers();
  registerConceptHandlers();
  registerTopicHandlers();
  registerWikiHandlers();
  registerReflectionHandlers();
  registerSmartTaskHandlers();
  registerTaskHandlers();
  registerSearchHandlers();
  registerUpdateHandlers();
  registerTemplateHandlers();
  registerAttachmentHandlers();
  registerResourceHandlers();

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

  // 异步触发资源同步（每日一次；距上次成功同步不足 24h 则跳过，由定时任务兜底）
  if (resourceSyncService.shouldDailySync()) {
    resourceSyncService.checkAndSync().catch((err) => {
      Logger.error("资源同步启动失败", { error: String(err) });
    });
  } else {
    Logger.info("资源同步：距上次成功同步不足 24 小时，跳过启动同步，由每日定时任务执行");
  }

  // 初始化定时任务调度器
  scheduler.startAll()
  Logger.info('定时任务调度器已启动')

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  isAppQuitting = true
  trayService.destroy()
})

app.on("window-all-closed", () => {
  // 有系统托盘时，不自动退出应用
  if (!trayService.isInitialized()) {
    app.quit()
  }
});
