import { TaskExecutor, TaskContext, TaskResult } from "../types";
import { ChunkDao, ProjectChunkDao } from "@/main/core/db";
import { vectorService } from "@/main/core/services/ai/vector.service";
import { semanticLinkDao } from "@/main/core/db/semanticLink.dao";
import { localGateway } from "@/main/core/model-gateway/local-gateway";
import { progressManager } from "@/main/core/smart-tasks/progress.manager";
import { Chunk, ChunkUpdate } from "@/main/types/db";
import { SemanticLinkCreate } from "@/main/types/db";
import { Logger } from "@/main/utils/logger";
import { TimeUtil } from "@/shared/utils";
import { DEFAULT_TEMPORAL_SCORE_CONFIG } from "@/main/constants/auto.constants";
import { mapWithConcurrency } from "../concurrency";

/**
 * 语义链接的并发上限：瓶颈是「LanceDB ANN（I/O）→ reranker（CPU）」交替，
 * 适度并发即可让 I/O 与 CPU 重叠；更高只会让 reranker 在线程内排队。
 */
export const SEMANTIC_LINK_CONCURRENCY = 3;

const ANN_TOP_K = 20;
const RERANK_TOP_K = 5;

export class SemanticLinkExecutor implements TaskExecutor {
  public name = "semantic-link";
  public dependencies = ["chunk-vectorize"];

  private chunkDao = new ChunkDao();
  private projectChunkDao = new ProjectChunkDao();

  public async run(context: TaskContext): Promise<TaskResult> {
    const blocks = this.getVectorizedBlocks(context.processedUntil);
    const total = blocks.length;

    if (total === 0) {
      return { taskName: this.name, success: true, processedCount: 0 };
    }

    let processed = 0;

    await mapWithConcurrency(
      blocks,
      SEMANTIC_LINK_CONCURRENCY,
      async (block) => {
        try {
          const summary = block.ai_summary || block.content;

          // Step 1: 查询 block 的向量
          const blockEmbeddings = await vectorService.findBlockEmbeddingByBlockId(block.id);
          if (!blockEmbeddings || blockEmbeddings.length === 0) return;

          // Step 2: LanceDB ANN 检索
          // 语义块若归属某作品，则把检索限制在同一作品内 —— 否则会跨作品建立
          // semantic_links（数据污染；一旦有消费方就变成信息泄漏）。
          // 未归属作品的块（如日记）保持原有全局行为。
          const projectLinks = this.projectChunkDao.findBy("chunk_id", block.id);
          const projectId = projectLinks[0]?.project_id;

          const annResults = await vectorService.searchBlockEmbeddings({
            vector: blockEmbeddings[0].embedding,
            topK: ANN_TOP_K,
            ...(projectId ? { projectId } : {}),
          });

          const candidates = annResults
            .filter((r) => r.item.block_id !== block.id)
            .slice(0, ANN_TOP_K);

          if (candidates.length === 0) return;

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

          // 方案 C：链接建立后顺带写入初始时间热度分（以块 created_at 为基准），
          // 后续随时间衰减由定时任务滚动重算。
          const update: ChunkUpdate = {
            last_smart_processed_at: new Date().toISOString(),
            temporal_score: TimeUtil.temporalScore(
              block.created_at,
              new Date(),
              DEFAULT_TEMPORAL_SCORE_CONFIG.halfLifeDays,
            ),
          };
          this.chunkDao.update(block.id, update);

          processed++;
          progressManager.update(this.name, processed, total);
        } catch (error) {
          Logger.error("[SemanticLinkExecutor] 处理失败", { blockId: block.id, error: String(error) });
          processed++;
        }
      },
      context.cancelSignal,
    );

    if (context.cancelSignal.cancelled) {
      return { taskName: this.name, success: false, processedCount: processed, error: "已取消" };
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
