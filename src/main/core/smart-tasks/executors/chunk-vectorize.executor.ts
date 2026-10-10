import { TaskExecutor, TaskContext, TaskResult } from "../types";
import { ChunkDao, ProjectChunkDao } from "@/main/core/db";
import { vectorService } from "@/main/core/services/ai/vector.service";
import { buildChunkEmbeddings } from "@/main/core/vector/vector-payload";
import { buildEmbeddingText } from "@/main/core/services/content/splitting/embedding-text";
import { localGateway } from "@/main/core/model-gateway/local-gateway";
import { progressManager } from "@/main/core/smart-tasks/progress.manager";
import { Chunk } from "@/main/types/db";
import { Logger } from "@/main/utils/logger";

export class ChunkVectorizeExecutor implements TaskExecutor {
  public name = "chunk-vectorize";
  // 依赖摘要阶段：向量化要求上游已跑完（标记列有值），且需要 summary 先于本任务运行。
  public dependencies = ["chunk-summary"];

  private chunkDao = new ChunkDao();
  private projectChunkDao = new ProjectChunkDao();

  private resolveProjectId(blockId: string): string | null {
    const links = this.projectChunkDao.findBy("chunk_id", blockId);
    return links[0]?.project_id ?? null;
  }

  public async run(context: TaskContext): Promise<TaskResult> {
    // 选取只看本任务自己的 last_vectorized_at，不再叠加 DAG 级水位：
    // 水位会把上一轮之后的未向量化块整体跳过，失败批次也永不重试
    const blocks = this.getUnvectorizedBlocks();
    const total = blocks.length;

    if (total === 0) {
      return {
        taskName: this.name,
        success: true,
        processedCount: 0,
        failedCount: 0,
      };
    }

    const batchSize = 16;
    let processed = 0;
    let failed = 0;

    for (let i = 0; i < blocks.length; i += batchSize) {
      if (context.cancelSignal.cancelled) {
        return {
          taskName: this.name,
          success: false,
          processedCount: processed,
          failedCount: failed,
          error: "已取消",
        };
      }

      const batch = blocks.slice(i, i + batchSize);
      const texts = batch.map((block) => buildEmbeddingText(block));

      try {
        const results = await localGateway.embedBatch(texts);

        const vectorList = results.map((r) => r.vector);
        const vectors = buildChunkEmbeddings(batch, vectorList, (blockId) =>
          this.resolveProjectId(blockId),
        );

        await vectorService.createChunkEmbeddings(vectors);

        // 标记写入不刷新 updated_at，否则本块下一轮会被自己重新选中
        this.chunkDao.recordStageBatch(batch.map((block) => block.id), [
          "last_vectorized_at",
          "last_smart_processed_at",
        ]);

        processed += batch.length;
        progressManager.update(this.name, processed + failed, total);
      } catch (error) {
        // 失败批不写标记：下一轮重嵌。此前把失败批也计入完成量，
        // 等于一次 embedding 故障就永久丢掉这批向量
        failed += batch.length;
        Logger.error("[ChunkVectorizeExecutor] 处理 batch 失败", {
          error: String(error),
          batch: i,
        });
      }
    }

    // success 仍表示「本阶段跑完了」：部分失败交给标记列自愈，
    // 不让一个坏批次把整条 DAG 判死（下游依赖的是 success，不是计数）
    return {
      taskName: this.name,
      success: true,
      processedCount: processed,
      failedCount: failed,
    };
  }

  private getUnvectorizedBlocks(): Chunk[] {
    // 以本任务专用的 last_vectorized_at 判定"未向量化"，避免与 chunk-summary
    // 等任务共用的 last_smart_processed_at 冲突（后者会被 summary 提前写入，
    // 导致向量化永远选出 0 条）。
    // 正文改过的块（updated_at 晚于标记）重嵌；软删除的墓碑块不烧算力。
    // 上游门槛读摘要阶段的**标记列**而不是 ai_summary：代码块 / 围栏这类无正文可摘要的块
    // 永远不会有摘要，但它们仍然要进向量库（嵌入文本取自 content），否则搜不到。
    return this.chunkDao.query(
      `SELECT * FROM semantic_chunks
       WHERE last_summary_generated_at IS NOT NULL AND status = 'active'
         AND (last_vectorized_at IS NULL OR updated_at > last_vectorized_at)`,
    ) as Chunk[];
  }
}
