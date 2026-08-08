import { TaskExecutor, TaskContext, TaskResult } from "../types";
import { ChunkDao } from "@/main/core/db";
import { vectorService } from "@/main/core/services/vector.service";
import { localGateway } from "@/main/core/model-gateway/local-gateway";
import { progressManager } from "@/main/core/smart-tasks/progress.manager";
import { Chunk, ChunkUpdate } from "@/main/types/db";
import { Logger } from "@/main/utils/logger";

export class ChunkVectorizeExecutor implements TaskExecutor {
  public name = "chunk-vectorize";
  public dependencies: string[] = [];

  private chunkDao = new ChunkDao();

  public async run(context: TaskContext): Promise<TaskResult> {
    const blocks = this.getUnprocessedBlocks(context.processedUntil);
    const total = blocks.length;

    if (total === 0) {
      return { taskName: this.name, success: true, processedCount: 0 };
    }

    const batchSize = 16;
    let processed = 0;

    for (let i = 0; i < blocks.length; i += batchSize) {
      if (context.cancelSignal.cancelled) {
        return { taskName: this.name, success: false, processedCount: processed, error: "已取消" };
      }

      const batch = blocks.slice(i, i + batchSize);
      const texts = batch.map((b) => b.ai_summary || b.content);

      try {
        const results = await localGateway.embedBatch(texts);

        const vectors = results.map((r, idx) => ({
          block_id: batch[idx].id,
          content: texts[idx],
          vector: r.vector,
        }));

        await vectorService.createBlockEmbeddingBatch(vectors);

        for (const b of batch) {
          const update: ChunkUpdate = { last_smart_processed_at: new Date().toISOString() };
          this.chunkDao.update(b.id, update);
        }

        processed += batch.length;
        progressManager.update(this.name, processed, total);
      } catch (error) {
        Logger.error("[ChunkVectorizeExecutor] 处理 batch 失败", { error: String(error), batch: i });
        // 不中断，继续处理下一批
        processed += batch.length;
      }
    }

    return { taskName: this.name, success: true, processedCount: processed };
  }

  private getUnprocessedBlocks(processedUntil: string | null): Chunk[] {
    if (processedUntil) {
      return this.chunkDao.db
        .prepare(
          `SELECT * FROM blocks WHERE (last_smart_processed_at IS NULL OR last_smart_processed_at < updated_at) AND updated_at > ? AND ai_summary IS NOT NULL`,
        )
        .all(processedUntil) as Chunk[];
    }
    return this.chunkDao.db
      .prepare(`SELECT * FROM blocks WHERE ai_summary IS NOT NULL AND last_smart_processed_at IS NULL`)
      .all() as Chunk[];
  }
}