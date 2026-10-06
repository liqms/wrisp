import { TaskExecutor, TaskContext, TaskResult } from "../types";
import { ChunkDao, ProjectChunkDao } from "@/main/core/db";
import { vectorService } from "@/main/core/services/ai/vector.service";
import { buildBlockEmbeddings } from "@/main/core/vector/vector-payload";
import { buildEmbeddingText } from "@/main/core/services/content/splitting/embedding-text";
import { localGateway } from "@/main/core/model-gateway/local-gateway";
import { progressManager } from "@/main/core/smart-tasks/progress.manager";
import { Chunk, ChunkUpdate } from "@/main/types/db";
import { Logger } from "@/main/utils/logger";

export class ChunkVectorizeExecutor implements TaskExecutor {
  public name = "chunk-vectorize";
  // 依赖摘要：向量化选取要求 ai_summary 已生成，且需要 summary 先于本任务运行。
  public dependencies = ["chunk-summary"];

  private chunkDao = new ChunkDao();
  private projectChunkDao = new ProjectChunkDao();

  private resolveProjectId(blockId: string): string | null {
    const links = this.projectChunkDao.findBy("chunk_id", blockId);
    return links[0]?.project_id ?? null;
  }

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
      const texts = batch.map((block) => buildEmbeddingText(block));

      try {
        const results = await localGateway.embedBatch(texts);

        const vectorList = results.map((r) => r.vector);
        const vectors = buildBlockEmbeddings(batch, vectorList, (blockId) =>
          this.resolveProjectId(blockId),
        );

        await vectorService.createBlockEmbeddings(vectors);

        for (const b of batch) {
          const update: ChunkUpdate = { last_vectorized_at: new Date().toISOString() };
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
    // 以本任务专用的 last_vectorized_at 判定"未向量化"，避免与 chunk-summary
    // 等任务共用的 last_smart_processed_at 冲突（后者会被 summary 提前写入，
    // 导致向量化永远选出 0 条）。
    if (processedUntil) {
      return this.chunkDao.query(
        `SELECT * FROM semantic_chunks WHERE last_vectorized_at IS NULL AND ai_summary IS NOT NULL AND updated_at > ?`,
        [processedUntil],
      ) as Chunk[];
    }
    return this.chunkDao.query(
      `SELECT * FROM semantic_chunks WHERE last_vectorized_at IS NULL AND ai_summary IS NOT NULL`,
    ) as Chunk[];
  }
}
