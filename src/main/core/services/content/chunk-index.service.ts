import { Logger } from "@/main/utils/logger";
import { FileIndexDao } from "@/main/core/db";
import { taskQueue } from "@/main/core/task-queue";
import { fileService } from "@/main/core/services/base/file.service";
import { modelRouter } from "@/main/core/model-gateway/router";
import { embedBatch } from "@/main/core/model-gateway/local-gateway";
import { chunkService } from "./chunk.service";
import {
  collectChunks,
  hasRefineTargets,
  refineDocument,
  splitDocument,
  thresholdForChunkType,
} from "./chunk-splitter";
import { notifyWikiUpdated } from "./wiki-events";
import type { SentenceEmbedder, SplitChunk } from "./splitting/types";
import type { ChunkType } from "@/main/types/db";

/**
 * 语义块索引服务
 *
 * 负责把"文件保存"与"语义块切分"解耦：
 *   save → schedule()（静默窗口内多次保存合并）→ 入队 file:chunk 任务
 *        → processFile()（校验文件 hash 未变化）→ L1+L2 切分 → 按 content_hash 差异同步写库
 *        → 有超长块时入队 file:chunk-refine → processRefine() → L3 语义精修
 *
 * 走任务队列异步执行，避免阻塞保存路径；静默窗口收敛实时保存产生的抖动；
 * L1/L2 不调模型，因此保存→可检索的链路始终与本地模型是否就绪无关；
 * L3 只在本地嵌入模型可用时运行，失败/不可用一律保留 L2 结果。
 */

/** 静默窗口：窗口内的多次保存合并为一次切分（ms） */
export const CHUNK_SILENT_WINDOW_MS = 5000;
/** 任务队列中的切分任务类型 */
export const TASK_TYPE_FILE_CHUNK = "file:chunk";
/** 任务队列中的语义精修（L3）任务类型 */
export const TASK_TYPE_FILE_CHUNK_REFINE = "file:chunk-refine";

export interface FileChunkPayload {
  fileId: string;
  fileHash: string;
  /** 语义块来源类型，默认 journal */
  chunkType?: ChunkType;
  /** 作品 ID（chunk_type = "page" 时用于建立 project_chunks 归属） */
  projectId?: string | null;
}

/** 同一文件的切分任务共用一个 groupId，便于入队前取消旧任务实现去重 */
export function chunkTaskGroupId(fileId: string): string {
  return `file-chunk:${fileId}`;
}

/** 同一文件的 L3 精修任务 groupId */
export function chunkRefineTaskGroupId(fileId: string): string {
  return `file-chunk-refine:${fileId}`;
}

interface PendingSchedule {
  timer: NodeJS.Timeout;
  fileHash: string;
  chunkType: ChunkType;
  projectId: string | null;
}

/** 两次切分的边界是否完全一致（按内容哈希序列比较） */
function isSameBoundary(left: SplitChunk[], right: SplitChunk[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((chunk, index) => chunk.contentHash === right[index].contentHash);
}

class ChunkIndexService {
  private static instance: ChunkIndexService;
  private fileIndexDao: FileIndexDao;
  /** fileId → 待执行调度（静默窗口计时器 + 最新 hash） */
  private pending = new Map<string, PendingSchedule>();

  private constructor() {
    this.fileIndexDao = new FileIndexDao();
  }

  public static getInstance(): ChunkIndexService {
    if (!ChunkIndexService.instance) {
      ChunkIndexService.instance = new ChunkIndexService();
    }
    return ChunkIndexService.instance;
  }

  /**
   * 调度文件切分。静默窗口内重复调用会重置计时器，
   * 且只保留最新 hash（窗口到期后按最新内容切分）。
   */
  public schedule(
    fileId: string,
    fileHash: string,
    chunkType: ChunkType = "journal",
    projectId: string | null = null,
  ): void {
    if (!fileId) return;

    const existing = this.pending.get(fileId);
    if (existing) clearTimeout(existing.timer);

    const timer = setTimeout(() => {
      this.pending.delete(fileId);
      void this.enqueue(
        TASK_TYPE_FILE_CHUNK,
        chunkTaskGroupId(fileId),
        { fileId, fileHash, chunkType, projectId },
      );
    }, CHUNK_SILENT_WINDOW_MS);
    // 不因待执行的调度而阻塞进程退出
    timer.unref();

    this.pending.set(fileId, { timer, fileHash, chunkType, projectId });
  }

  /** 入队任务：同组先取消旧的待执行任务，保证同一文件同时只有一个切分/精修 */
  private async enqueue(
    type: string,
    groupId: string,
    payload: FileChunkPayload,
  ): Promise<void> {
    try {
      // 队列无内建去重，靠 groupId 手动互斥
      const oldTasks = await taskQueue.getTasksByGroup(groupId);
      for (const task of oldTasks) {
        if (task.status === "pending" || task.status === "running") {
          await taskQueue.cancel(task.id);
        }
      }

      await taskQueue.enqueue({ type, payload, groupId });
    } catch (error) {
      Logger.error("[ChunkIndex] 切分任务入队失败", {
        fileId: payload.fileId,
        type,
        error: String(error),
      });
    }
  }

  /**
   * 执行切分：读取文件 → L1+L2 → 按 content_hash 差异同步写库 → 有超长块时排入 L3 精修。
   *
   * 执行前校验文件 hash：若与入队时不一致，说明已有更新的保存（新任务已入队），
   * 当前任务直接作废，避免"旧内容覆盖新内容"。
   */
  public async processFile(
    fileId: string,
    fileHash: string,
    chunkType: ChunkType = "journal",
    projectId: string | null = null,
  ): Promise<void> {
    const index = this.fileIndexDao.findById(fileId);
    if (!index) {
      Logger.warn("[ChunkIndex] 文件索引不存在，跳过切分", { fileId });
      return;
    }
    if (index.file_hash !== fileHash) {
      Logger.info("[ChunkIndex] 文件已变化，丢弃过期的切分任务", { fileId });
      return;
    }

    try {
      const markdown = fileService.readFile(index.file_path);
      const result = splitDocument(markdown);

      const synced = chunkService.replaceFileChunks(
        fileId,
        index.file_path,
        collectChunks(result.segments),
        chunkType,
      );
      // 顺序要紧在替换之后：只有正文真正消失的块才删向量，复用块的向量继续可用
      await chunkService.dropVectorsByIds(synced.removedIds);

      // 页面内容：切分完成后把该文件的语义块归属到所在作品，
      // 供作品内材料检索与语义链接的作品收敛（journal 走 chunk.update 路径，不变）
      if (chunkType === "page") {
        chunkService.associateFileChunksWithProject(fileId, projectId);
      }

      this.fileIndexDao.updateSyncStatus(fileId, "synced");
      Logger.info("[ChunkIndex] 文件切分完成", {
        fileId,
        filePath: index.file_path,
        chunks: synced.total,
        reused: synced.reused,
        coarse: result.stats.coarse,
        pendingRefine: result.stats.refined,
      });
      // 语义块已变化，通知渲染层刷新 Wiki 数据（去抖合并）
      notifyWikiUpdated();

      if (hasRefineTargets(result)) {
        await this.enqueue(
          TASK_TYPE_FILE_CHUNK_REFINE,
          chunkRefineTaskGroupId(fileId),
          { fileId, fileHash, chunkType, projectId },
        );
      }
    } catch (error) {
      // 标记失败后抛出，交由任务队列按 max_retries 重试
      this.fileIndexDao.updateSyncStatus(fileId, "failed");
      Logger.error("[ChunkIndex] 文件切分失败", {
        fileId,
        filePath: index.file_path,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * 执行 L3 语义精修：对 L2 按长度切过的块，改在句子语义低谷处切分后差异同步。
   *
   * 与 processFile 的关键差别：**失败不标记文件同步失败**。L2 结果此时已写库且可检索，
   * 精修只是边界优化，模型不可用 / 推理异常都只降级，不该把文件打成红色状态。
   */
  public async processRefine(
    fileId: string,
    fileHash: string,
    chunkType: ChunkType = "journal",
    projectId: string | null = null,
  ): Promise<void> {
    const index = this.fileIndexDao.findById(fileId);
    if (!index) {
      Logger.warn("[ChunkIndex] 文件索引不存在，跳过语义精修", { fileId });
      return;
    }
    if (index.file_hash !== fileHash) {
      Logger.info("[ChunkIndex] 文件已变化，丢弃过期的精修任务", { fileId });
      return;
    }
    if (!(await modelRouter.isLocalAvailable())) {
      Logger.info("[ChunkIndex] 本地嵌入模型不可用，跳过语义精修", { fileId });
      return;
    }

    try {
      const markdown = fileService.readFile(index.file_path);
      const result = splitDocument(markdown);
      if (!hasRefineTargets(result)) return;

      const embedder: SentenceEmbedder = async (texts) =>
        (await embedBatch(texts)).map((r) => r.vector);
      const refined = await refineDocument(
        result,
        embedder,
        thresholdForChunkType(chunkType),
      );

      const current = collectChunks(result.segments);
      if (isSameBoundary(current, refined)) {
        Logger.debug("[ChunkIndex] 语义边界与长度切分一致，无需替换", { fileId });
        return;
      }

      const synced = chunkService.replaceFileChunks(
        fileId,
        index.file_path,
        refined,
        chunkType,
      );
      await chunkService.dropVectorsByIds(synced.removedIds);
      if (chunkType === "page") {
        chunkService.associateFileChunksWithProject(fileId, projectId);
      }

      Logger.info("[ChunkIndex] 语义精修完成", {
        fileId,
        chunks: refined.length,
        reused: synced.reused,
        refinedBlocks: result.stats.refined,
      });
      notifyWikiUpdated();
    } catch (error) {
      Logger.error("[ChunkIndex] 语义精修失败，保留长度切分结果", {
        fileId,
        error: String(error),
      });
    }
  }
}

export const chunkIndexService = ChunkIndexService.getInstance();