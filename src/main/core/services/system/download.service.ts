/**
 * DownloadService — 文件下载服务
 * 单例模式，支持并发下载、队列管理、进度通知、取消/分组管理等
 */

import { app } from "electron";
import fs from "fs";
import path from "path";
import { EventEmitter } from "events";
import { HttpClient } from "@/main/utils/http";
import { NodeCryptoUtil } from "@/main/utils/crypto";
import type {
  DownloadProgress,
  DownloadTask,
} from "@/main/types/download.types";

const DOWNLOAD_ERROR = {
  CANCELLED: "下载已取消",
  TIMEOUT: "下载超时",
} as const;

const DEFAULT_MAX_CONCURRENT = 3;
const DOWNLOAD_TIMEOUT = 60000;

interface QueueItem {
  url: string;
  subDir: string;
  taskId: string;
  resolve: (path: string) => void;
  reject: (error: Error) => void;
  groupId?: string;
  fileName?: string;
}

/** 下载事件名 → 监听器签名映射 */
interface DownloadServiceEvents {
  progress: (progress: DownloadProgress) => void;
  complete: (taskId: string, localPath: string) => void;
  error: (taskId: string, error: string) => void;
}

const httpClient = new HttpClient();

/**
 * 文件下载服务，单例模式
 * 管理下载任务的生命周期：排队、执行、进度通知、取消
 */
class DownloadService {
  private static instance: DownloadService | null = null;
  private tasks: Map<string, DownloadTask> = new Map();
  private eventEmitter: EventEmitter = new EventEmitter();
  private userDataPath: string;
  private cachePath: string;
  private maxConcurrentDownloads = DEFAULT_MAX_CONCURRENT;
  private activeDownloads = 0;
  private pendingQueue: QueueItem[] = [];

  /** 初始化下载服务，创建缓存目录 */
  private constructor() {
    this.userDataPath = app.getPath("userData");
    this.cachePath = path.join(this.userDataPath, "Cache");
    fs.mkdirSync(this.cachePath, { recursive: true });
  }

  /** 获取 DownloadService 单例实例 */
  public static getInstance(): DownloadService {
    if (!DownloadService.instance) {
      DownloadService.instance = new DownloadService();
    }
    return DownloadService.instance;
  }

  /** 监听下载事件（progress / complete / error） */
  public on<K extends keyof DownloadServiceEvents>(
    event: K,
    listener: DownloadServiceEvents[K],
  ): this {
    this.eventEmitter.on(event, listener as (...args: unknown[]) => void);
    return this;
  }

  /** 移除下载事件监听（progress / complete / error） */
  public off<K extends keyof DownloadServiceEvents>(
    event: K,
    listener: DownloadServiceEvents[K],
  ): this {
    this.eventEmitter.off(event, listener as (...args: unknown[]) => void);
    return this;
  }

  /**
   * 添加下载任务到队列
   * @param url 下载地址
   * @param subDir 缓存子目录
   * @param options 可选配置（分组 ID、自定义文件名）
   * @returns 下载完成后的本地文件路径
   */
  public download(url: string, subDir: string, options?: { groupId?: string; fileName?: string }): Promise<string> {
    return new Promise((resolve, reject) => {
      const taskId = NodeCryptoUtil.generateUUID();
      const fullSubDir = path.join(this.cachePath, subDir);

      fs.mkdirSync(fullSubDir, { recursive: true });

      const task: DownloadTask = {
        taskId,
        url,
        subDir,
        status: "pending",
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        groupId: options?.groupId,
        fileName: options?.fileName,
      };
      this.tasks.set(taskId, task);

      this.notifyProgress(task);

      this.pendingQueue.push({ url, subDir, taskId, resolve, reject, groupId: options?.groupId, fileName: options?.fileName });
      this.processQueue();
    });
  }

  /** 处理下载队列，按最大并发数依次执行 */
  private async processQueue(): Promise<void> {
    if (
      this.activeDownloads >= this.maxConcurrentDownloads ||
      this.pendingQueue.length === 0
    ) {
      return;
    }

    const item = this.pendingQueue.shift();
    if (!item) return;

    this.activeDownloads++;
    await this.executeDownload(item);
    this.activeDownloads--;
    this.processQueue();
  }

  /** 清理文件名中的非法字符，防止路径遍历 */
  private sanitizeFileName(fileName: string): string {
    const safe = fileName.replace(/[<>:"/\\|?*]/g, "_").trim();
    return safe || `download_${Date.now()}`;
  }

  /** 执行单个下载任务（流式写入文件，带进度通知） */
  private async executeDownload(item: QueueItem): Promise<void> {
    const { url, subDir, taskId, resolve, reject } = item;
    const task = this.tasks.get(taskId);
    if (!task) return;

    try {
      const parsedUrl = new URL(url);

      const fullSubDir = path.join(this.cachePath, subDir);
      const fileName = this.sanitizeFileName(path.basename(parsedUrl.pathname));
      const localPath = path.join(fullSubDir, fileName);

      task.status = "downloading";
      task.localPath = localPath;
      this.notifyProgress(task);

      const abortController = new AbortController();
      task.abortController = abortController;

      const { stream, totalBytes } = await httpClient.downloadStream(url, {
        signal: abortController.signal,
        timeout: DOWNLOAD_TIMEOUT,
      });
      task.totalBytes = totalBytes;

      const fileStream = fs.createWriteStream(localPath);

      await new Promise<void>((res, rej) => {
        let downloadedBytes = 0;

        stream.on("data", (chunk: Buffer) => {
          if (task.status === "cancelled") {
            fileStream.close();
            fs.unlinkSync(localPath);
            rej(new Error(DOWNLOAD_ERROR.CANCELLED));
            return;
          }

          downloadedBytes += chunk.length;
          task.downloadedBytes = downloadedBytes;
          task.progress =
            totalBytes > 0
              ? Math.round((downloadedBytes / totalBytes) * 100)
              : 0;
          this.notifyProgress(task);
        });

        stream.pipe(fileStream);

        fileStream.on("finish", () => {
          res();
        });

        fileStream.on("error", (err) => {
          rej(err);
        });
      });

      task.status = "completed";
      task.progress = 100;
      this.notifyProgress(task);
      this.eventEmitter.emit("complete", taskId, localPath);
      resolve(localPath);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      task.status = task.status === "cancelled" ? "cancelled" : "failed";
      task.error = errorMessage;
      this.notifyProgress(task);
      this.eventEmitter.emit("error", taskId, errorMessage);
      reject(new Error(errorMessage));
    }
  }

  /** 将 DownloadTask 转换为对外暴露的 DownloadProgress 格式 */
  private toProgress(task: DownloadTask): DownloadProgress {
    return {
      taskId: task.taskId,
      url: task.url,
      progress: task.progress,
      downloadedBytes: task.downloadedBytes,
      totalBytes: task.totalBytes,
      status: task.status,
      error: task.error,
      localPath: task.localPath,
      groupId: task.groupId,
      fileName: task.fileName,
    };
  }

  /** 发射进度事件通知监听者 */
  private notifyProgress(task: DownloadTask): void {
    this.eventEmitter.emit("progress", this.toProgress(task));
  }

  /** 获取指定任务的下载状态 */
  public getTaskStatus(taskId: string): DownloadProgress | null {
    const task = this.tasks.get(taskId);
    return task ? this.toProgress(task) : null;
  }

  /** 取消指定下载任务 */
  public cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === "completed" || task.status === "failed") {
      return false;
    }

    task.status = "cancelled";
    task.abortController?.abort();
    this.notifyProgress(task);
    return true;
  }

  /** 从任务列表中移除指定任务记录 */
  public removeTask(taskId: string): void {
    this.tasks.delete(taskId);
  }

  /**
   * 按 groupId 取消所有下载任务
   * @param groupId 分组 ID
   * @returns 取消的任务数量
   */
  public cancelByGroup(groupId: string): number {
    let count = 0;
    for (const [taskId, task] of this.tasks) {
      if (task.groupId === groupId && task.status !== "completed" && task.status !== "failed") {
        task.status = "cancelled";
        task.abortController?.abort();
        this.notifyProgress(task);
        this.tasks.delete(taskId);
        count++;
      }
    }
    // 同时清理 pending 队列中匹配的任务
    this.pendingQueue = this.pendingQueue.filter((item) => {
      if (item.groupId === groupId) {
        count++;
        return false;
      }
      return true;
    });
    return count;
  }

  /** 获取所有下载任务的状态列表 */
  public getAllTasks(): DownloadProgress[] {
    return Array.from(this.tasks.values()).map((task) => this.toProgress(task));
  }

  /** 获取缓存根目录路径 */
  public getCachePath(): string {
    return this.cachePath;
  }

  /** 获取缓存子目录路径（自动创建） */
  public getSubDirPath(subDir: string): string {
    const subDirPath = path.join(this.cachePath, subDir);
    fs.mkdirSync(subDirPath, { recursive: true });
    return subDirPath;
  }
}

export default DownloadService;

export const downloadService = DownloadService.getInstance();
