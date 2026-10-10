import { TaskExecutor, TaskContext, TaskResult } from "../types";
import { ChunkDao } from "@/main/core/db";
import { aiService } from "@/main/core/services/ai/ai.service";
import { progressManager } from "@/main/core/smart-tasks/progress.manager";
import { Chunk } from "@/main/types/db";
import { Logger } from "@/main/utils/logger";
import { TASK_TYPE } from "@/shared/enums";
import { mapWithConcurrency } from "../concurrency";
import { localAiManager } from "@/main/core/model-gateway/local-gateway";
import { countProseWords } from "@/main/core/services/content/splitting/text";
import { CHUNK_SUMMARY_MIN_PROSE_WORDS } from "@/main/constants";

/** 本阶段完成时要落的两列：专用标记供增量选取，共用标记仅供观测 */
const STAGE_COLUMNS = ["last_summary_generated_at", "last_smart_processed_at"] as const;

/** 短块直接回显原文的字符上限 */
const VERBATIM_MAX_CHARS = 200;

export class ChunkSummaryExecutor implements TaskExecutor {
  public name = "chunk-summary";
  public dependencies: string[] = [];

  private chunkDao = new ChunkDao();

  public async run(context: TaskContext): Promise<TaskResult> {
    // 选取用本阶段专属的 last_summary_generated_at，不再看 ai_summary 是否为空：
    // 「无正文可摘要」的块压根不写摘要，用产物判增量就会每轮把它们重新选出来。
    // 与 §3.7 其余阶段同形（updated_at > 标记），正文改动后自动重入。
    const blocks = this.getPendingBlocks();
    const total = blocks.length;

    if (total === 0) {
      return {
        taskName: this.name,
        success: true,
        processedCount: 0,
        failedCount: 0,
      };
    }

    let processed = 0;
    let failed = 0;
    let skipped = 0;
    const limit = Math.max(1, localAiManager.getLlmConcurrency());

    await mapWithConcurrency(
      blocks,
      limit,
      async (block) => {
        try {
          if (countProseWords(block.content) < CHUNK_SUMMARY_MIN_PROSE_WORDS) {
            // 只有围栏 / 图片 / 一行清单：没有可供概括的文字，标记后即视为完成
            this.chunkDao.recordStage(block.id, STAGE_COLUMNS);
            skipped++;
            processed++;
          } else {
            const summary = await this.generateSummary(block);
            // 摘要走 update()：它是块的正文派生列，刷新 updated_at 让下游阶段
            // （向量化 / 概念抽取）把「摘要刚生成」当作一次需要重跑的变更。
            // 顺序要紧：先 update 再写标记，标记才会 >= 水位线。
            this.chunkDao.update(block.id, { ai_summary: summary });
            this.chunkDao.recordStage(block.id, STAGE_COLUMNS);
            processed++;
          }
        } catch (error) {
          // 失败既不留摘要也不写标记，下一轮由选取条件自然重试（设计 §3.7）
          failed++;
          Logger.error("[ChunkSummaryExecutor] 生成摘要失败", {
            blockId: block.id,
            error: String(error),
          });
        } finally {
          // 进度按「尝试数」推进，否则失败条目会让本阶段永远差最后几个百分比
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
    if (skipped > 0) {
      Logger.info("[ChunkSummaryExecutor] 跳过无正文可摘要的块", {
        skipped,
        summarized: processed - skipped,
        failed,
      });
    }
    return {
      taskName: this.name,
      success: true,
      processedCount: processed,
      failedCount: failed,
      summary: { skippedCount: skipped },
    };
  }

  private async generateSummary(block: Chunk): Promise<string> {
    if (block.content.length <= VERBATIM_MAX_CHARS) {
      return block.content;
    }

    const prompt = `请用1-2句话概括以下内容的核心要点：\n\n${block.content}\n\n摘要：`;
    const result = await aiService.chatCompletion({
      messages: [{ role: "user", content: prompt }],
      taskType: TASK_TYPE.SUMMARY,
      background: true,
    });
    // 空产出不算成功：写进库就是一行「有摘要但没内容」的记录，下游会当正文用
    const summary = result.content?.trim() ?? "";
    if (!summary) throw new Error("模型未返回摘要内容");
    return summary;
  }

  private getPendingBlocks(): Chunk[] {
    return this.chunkDao.query(
      `SELECT * FROM semantic_chunks WHERE status = 'active' AND (last_summary_generated_at IS NULL OR updated_at > last_summary_generated_at)`,
    ) as Chunk[];
  }
}
