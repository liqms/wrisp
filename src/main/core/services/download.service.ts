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

const httpClient = new HttpClient();

class DownloadService {
  private static instance: DownloadService | null = null;
  private tasks: Map<string, DownloadTask> = new Map();
  private eventEmitter: EventEmitter = new EventEmitter();
  private userDataPath: string;
  private cachePath: string;
  private maxConcurrentDownloads = DEFAULT_MAX_CONCURRENT;
  private activeDownloads = 0;
  private pendingQueue: QueueItem[] = [];

  private constructor() {
    this.userDataPath = app.getPath("userData");
    this.cachePath = path.join(this.userDataPath, "Cache");
    fs.mkdirSync(this.cachePath, { recursive: true });
  }

  public static getInstance(): DownloadService {
    if (!DownloadService.instance) {
      DownloadService.instance = new DownloadService();
    }
    return DownloadService.instance;
  }

  public on(
    event: "progress",
    listener: (progress: DownloadProgress) => void,
  ): this;
  public on(
    event: "complete",
    listener: (taskId: string, localPath: string) => void,
  ): this;
  public on(
    event: "error",
    listener: (taskId: string, error: string) => void,
  ): this;
  public on(event: string, listener: (...args: any[]) => void): this {
    this.eventEmitter.on(event, listener);
    return this;
  }

  public off(
    event: "progress",
    listener: (progress: DownloadProgress) => void,
  ): this;
  public off(
    event: "complete",
    listener: (taskId: string, localPath: string) => void,
  ): this;
  public off(
    event: "error",
    listener: (taskId: string, error: string) => void,
  ): this;
  public off(event: string, listener: (...args: any[]) => void): this {
    this.eventEmitter.off(event, listener);
    return this;
  }

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

  private sanitizeFileName(fileName: string): string {
    const safe = fileName.replace(/[<>:"/\\|?*]/g, "_").trim();
    return safe || `download_${Date.now()}`;
  }

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

  private notifyProgress(task: DownloadTask): void {
    this.eventEmitter.emit("progress", this.toProgress(task));
  }

  public getTaskStatus(taskId: string): DownloadProgress | null {
    const task = this.tasks.get(taskId);
    return task ? this.toProgress(task) : null;
  }

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

  public getAllTasks(): DownloadProgress[] {
    return Array.from(this.tasks.values()).map((task) => this.toProgress(task));
  }

  public getCachePath(): string {
    return this.cachePath;
  }

  public getSubDirPath(subDir: string): string {
    const subDirPath = path.join(this.cachePath, subDir);
    fs.mkdirSync(subDirPath, { recursive: true });
    return subDirPath;
  }
}

export default DownloadService;

export const downloadService = DownloadService.getInstance();
