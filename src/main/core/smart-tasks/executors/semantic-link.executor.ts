import { TaskExecutor, TaskContext, TaskResult } from "../types";
import { ChunkDao } from "@/main/core/db";
import { vectorService } from "@/main/core/services/vector.service";
import { semanticLinkDao } from "@/main/core/db/semanticLink.dao";
import { localGateway } from "@/main/core/model-gateway/local-gateway";
import { progressManager } from "@/main/core/smart-tasks/progress.manager";
import { Chunk, ChunkUpdate } from "@/main/types/db";
import { SemanticLinkCreate } from "@/main/types/db";
import { Logger } from "@/main/utils/logger";

export class SemanticLinkExecutor implements TaskExecutor {
  public name = "semantic-link";
  public dependencies = ["chunk-vectorize"];

  private chunkDao = new ChunkDao();

  public async run(context: TaskContext): Promise<TaskResult> {
    const blocks = this.getVectorizedBlocks(context.processedUntil);
    const total = blocks.length;

    if (total === 0) {
      return { taskName: this.name, success: true, processedCount: 0 };
    }

    let processed = 0;
    const ANN_TOP_K = 20;
    const RERANK_TOP_K = 5;

    for (const block of blocks) {
      if (context.cancelSignal.cancelled) {
        return { taskName: this.name, success: false, processedCount: processed, error: "已取消" };
      }

      try {
        const summary = block.ai_summary || block.content;

        // Step 1: 查询 block 的向量
        const blockEmbeddings = await vectorService.findBlockEmbeddingByBlockId(block.id);
        if (!blockEmbeddings || blockEmbeddings.length === 0) continue;

        // Step 2: LanceDB ANN 检索
        const annResults = await vectorService.searchBlockEmbeddings({
          vector: blockEmbeddings[0].embedding,
          topK: ANN_TOP_K,
        });

        const candidates = annResults
          .filter((r) => r.item.block_id !== block.id)
          .slice(0, ANN_TOP_K);

        if (candidates.length === 0) continue;

        // Step 3: reranker 排序
        const candidateBlocks = candidates.map((c) =>
          this.chunkDao.findById(c.item.block_id),
        ).filter(Boolean) as Chunk[];

        const candidateContents = candidateBlocks.map((b) => b.ai_summary || b.content);
        const rerankResults = await localGateway.rerank(summary, candidateContents);

        // Step 4: 取 Top-N 写入 semantic_links
        const topLinks = rerankResults.slice(0, RERANK_TOP_K);
        const existingLinks = semanticLinkDao.findByChunkId(block.id);
        const existingTargetIds = new Set(existingLinks.map((l) => l.target_chunk_id));

        for (const rr of topLinks) {
          const target = candidateBlocks[rr.index];
          if (!target || existingTargetIds.has(target.id)) continue;

          const create: SemanticLinkCreate = {
            source_chunk_id: block.id,
            target_chunk_id: target.id,
            link_type: "semantic",
            similarity: rr.score,
          };

          try {
            semanticLinkDao.create(create);
          } catch {
            // 可能已存在，忽略
          }
        }

        const update: ChunkUpdate = { last_smart_processed_at: new Date().toISOString() };
        this.chunkDao.update(block.id, update);

        processed++;
        progressManager.update(this.name, processed, total);
      } catch (error) {
        Logger.error("[SemanticLinkExecutor] 处理失败", { blockId: block.id, error: String(error) });
        processed++;
      }
    }

    return { taskName: this.name, success: true, processedCount: processed };
  }

  private getVectorizedBlocks(processedUntil: string | null): Chunk[] {
    if (processedUntil) {
      return this.chunkDao.query(
        `SELECT * FROM semantic_chunks WHERE updated_at > ? AND ai_summary IS NOT NULL`,
        [processedUntil],
      ) as Chunk[];
    }
    return this.chunkDao.query(
      `SELECT * FROM semantic_chunks WHERE ai_summary IS NOT NULL`,
    ) as Chunk[];
  }
}