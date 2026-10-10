import { TaskExecutor, TaskContext, TaskResult } from "../types";
import { ChunkDao, ProjectChunkDao } from "@/main/core/db";
import { vectorService } from "@/main/core/services/ai/vector.service";
import { semanticLinkDao } from "@/main/core/db/semanticLink.dao";
import { localGateway } from "@/main/core/model-gateway/local-gateway";
import { progressManager } from "@/main/core/smart-tasks/progress.manager";
import { Chunk } from "@/main/types/db";
import { SemanticLinkCreate } from "@/main/types/db";
import { Logger } from "@/main/utils/logger";
import { TimeUtil } from "@/shared/utils";
import { DEFAULT_TEMPORAL_SCORE_CONFIG } from "@/main/constants/auto.constants";
import { DEFAULT_SMART_TASK_CONFIG } from "@/shared/constants/smart-task.constants";
import { mapWithConcurrency } from "../concurrency";
import { getSmartTaskConfig } from "../smart-task.config";

/**
 * 语义链接并发上限的兜底值（配置缺失时使用）。
 *
 * 本阶段的瓶颈是 reranker 交叉编码（纯 CPU），而非 ANN 的 I/O：并发 >1 时
 * 多个 rerank 请求在线程内排队，只会把同一批核心抢得更凶、并不提高吞吐。
 * 实际取值来自配置 `smartTask.semanticLinkConcurrency`。
 */
export const SEMANTIC_LINK_CONCURRENCY = DEFAULT_SMART_TASK_CONFIG.semanticLinkConcurrency;

export class SemanticLinkExecutor implements TaskExecutor {
  public name = "semantic-link";
  public dependencies = ["chunk-vectorize"];

  private chunkDao = new ChunkDao();
  private projectChunkDao = new ProjectChunkDao();

  public async run(context: TaskContext): Promise<TaskResult> {
    const config = getSmartTaskConfig();
    const blocks = this.getUnlinkedBlocks();
    const total = blocks.length;

    if (total === 0) {
      return {
        taskName: this.name,
        success: true,
        processedCount: 0,
        failedCount: 0,
      };
    }

    // 项目作用域一次性预取：逐块 findBy 会在每块的循环里多打一条 SQL
    const projectScope = this.loadProjectScope(blocks.map((b) => b.id));

    let processed = 0;
    let failed = 0;

    await mapWithConcurrency(
      blocks,
      Math.max(1, config.semanticLinkConcurrency),
      async (block) => {
        try {
          await this.linkBlock(block, projectScope.get(block.id), config);
          // 「没有候选可链」也算跑过本阶段：不写标记会让这块每轮空转一遍 ANN + rerank
          this.markLinked(block);
          processed++;
        } catch (error) {
          // 失败不写标记，下一轮重试（设计 §3.7）
          failed++;
          Logger.error("[SemanticLinkExecutor] 处理失败", {
            blockId: block.id,
            error: String(error),
          });
        } finally {
          progressManager.update(this.name, processed + failed, total);
        }
      },
      context.cancelSignal,
    );

    if (context.cancelSignal.cancelled) {
      return {
        taskName: this.name,
        success: false,
        processedCount: processed,
        failedCount: failed,
        error: "已取消",
      };
    }
    return {
      taskName: this.name,
      success: true,
      processedCount: processed,
      failedCount: failed,
    };
  }

  /** 单块的「ANN 召回 → rerank → 写链接」；无可链对象时正常返回 */
  private async linkBlock(
    block: Chunk,
    projectId: string | undefined,
    config: ReturnType<typeof getSmartTaskConfig>,
  ): Promise<void> {
    const summary = block.ai_summary || block.content;

    // Step 1: 查询 block 的向量
    const chunkEmbeddings = await vectorService.findChunkEmbeddingByChunkId(block.id);
    if (!chunkEmbeddings || chunkEmbeddings.length === 0) return;

    // Step 2: LanceDB ANN 检索
    // 语义块若归属某作品，则把检索限制在同一作品内 —— 否则会跨作品建立
    // semantic_links（数据污染；一旦有消费方就变成信息泄漏）。
    // 未归属作品的块（如日记）保持原有全局行为。
    const annResults = await vectorService.searchChunkEmbeddings({
      vector: chunkEmbeddings[0].embedding,
      topK: config.annTopK,
      ...(projectId ? { projectId } : {}),
    });

    const candidateIds = annResults
      .filter((r) => r.item.chunk_id !== block.id)
      .map((r) => r.item.chunk_id)
      .slice(0, config.annTopK);

    if (candidateIds.length === 0) return;

    // Step 3: reranker 排序（一次批量取回候选正文，替代逐个 findById）
    const candidateById = this.findCandidates(candidateIds);
    if (candidateById.size === 0) return;

    const candidateContents = candidateIds
      .map((id) => candidateById.get(id))
      .filter((b): b is Chunk => !!b)
      .map((b) => b.ai_summary || b.content);
    const rerankResults = await localGateway.rerank(summary, candidateContents);

    // Step 4: 取 Top-N 写入 semantic_links
    const topLinks = rerankResults.slice(0, config.rerankTopK);
    const existingLinks = semanticLinkDao.findByChunkId(block.id);
    const existingTargetIds = new Set(existingLinks.map((l) => l.target_chunk_id));

    for (const rr of topLinks) {
      // rerank 的 index 是「candidateContents 的下标」，必须用同一顺序回查
      const target = candidateIds[rr.index];
      if (!target || existingTargetIds.has(target)) continue;

      const create: SemanticLinkCreate = {
        source_chunk_id: block.id,
        target_chunk_id: target,
        link_type: "semantic",
        // 该列存的是 reranker 批内 softmax 概率：仅在同一批内有序，
        // 跨批不可比，任何消费方都不得对它做绝对阈值判定。
        similarity: rr.score,
      };

      try {
        semanticLinkDao.create(create);
      } catch {
        // 可能已存在，忽略
      }
    }
  }

  /**
   * 写链接阶段标记，并顺带落初始时间热度分（方案 C：以块 created_at 为基准，
   * 后续由定时任务滚动衰减）。
   *
   * 走 recordStage 而不是 update()：热度分与标记都不该刷新 `updated_at`，
   * 否则本块下一轮会被 `updated_at > last_linked_at` 重新选中。
   */
  private markLinked(block: Chunk): void {
    this.chunkDao.recordStage(
      block.id,
      ["last_linked_at", "last_smart_processed_at"],
      TimeUtil.temporalScore(
        block.created_at,
        new Date(),
        DEFAULT_TEMPORAL_SCORE_CONFIG.halfLifeDays,
      ),
    );
  }

  /** 一次查询拿到「块 id → 所属作品 id」，无归属的块不入表 */
  private loadProjectScope(chunkIds: string[]): Map<string, string> {
    const scope = new Map<string, string>();
    for (const link of this.projectChunkDao.findByChunkIds(chunkIds)) {
      if (!scope.has(link.chunk_id)) scope.set(link.chunk_id, link.project_id);
    }
    return scope;
  }

  /** 批量取回候选块正文，保持调用方给出的候选顺序可回查 */
  private findCandidates(candidateIds: string[]): Map<string, Chunk> {
    const byId = new Map<string, Chunk>();
    for (const chunk of this.chunkDao.findByIds(candidateIds)) {
      byId.set(chunk.id, chunk);
    }
    return byId;
  }

  private getUnlinkedBlocks(): Chunk[] {
    // 上游跑完（摘要阶段标记有值）的块才进关联；标记列写在自己的 last_linked_at 上。
    // 判据用标记列而不是 ai_summary：无正文可摘要的块没有摘要，但关联本来就有
    // `ai_summary || content` 的兜底，不该因此被排除在关联之外。
    return this.chunkDao.query(
      `SELECT * FROM semantic_chunks
       WHERE status = 'active' AND last_summary_generated_at IS NOT NULL
         AND (last_linked_at IS NULL OR updated_at > last_linked_at)`,
    ) as Chunk[];
  }
}
