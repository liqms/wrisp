import { TaskExecutor, TaskContext, TaskResult } from "../types";
import { ChunkDao } from "@/main/core/db";
import { aiService } from "@/main/core/services/ai/ai.service";
import { progressManager } from "@/main/core/smart-tasks/progress.manager";
import { Chunk, ChunkUpdate } from "@/main/types/db";
import { Logger } from "@/main/utils/logger";
import { TASK_TYPE } from "@/shared/enums";
import { TimeUtil } from "@/shared/utils/time";
import { mapWithConcurrency } from "../concurrency";
import { localAiManager } from "@/main/core/model-gateway/local-gateway";

export class ChunkSummaryExecutor implements TaskExecutor {
  public name = "chunk-summary";
  public dependencies: string[] = [];

  private chunkDao = new ChunkDao();

  public async run(context: TaskContext): Promise<TaskResult> {
    const blocks = this.getUnsummarizedBlocks(context.processedUntil);
    const total = blocks.length;

    if (total === 0) {
      return { taskName: this.name, success: true, processedCount: 0 };
    }

    let processed = 0;
    const limit = Math.max(1, localAiManager.getLlmConcurrency());

    await mapWithConcurrency(
      blocks,
      limit,
      async (block) => {
        try {
          const summary = await this.generateSummary(block);
          const update: ChunkUpdate = {
            ai_summary: summary,
            last_smart_processed_at: TimeUtil.getLocalDateString(),
          };
          this.chunkDao.update(block.id, update);
        } catch (error) {
          Logger.error("[ChunkSummaryExecutor] 生成摘要失败", { blockId: block.id, error: String(error) });
        } finally {
          processed++;
          progressManager.update(this.name, processed, total);
        }
      },
      context.cancelSignal,
    );

    if (context.cancelSignal.cancelled) {
      return { taskName: this.name, success: false, processedCount: processed, error: "已取消" };
    }
    return { taskName: this.name, success: true, processedCount: processed };
  }

  private async generateSummary(block: Chunk): Promise<string> {
    if (block.content.length <= 200) {
      return block.content;
    }

    const prompt = `请用1-2句话概括以下内容的核心要点：\n\n${block.content}\n\n摘要：`;
    const result = await aiService.chatCompletion({
      messages: [{ role: "user", content: prompt }],
      taskType: TASK_TYPE.SUMMARY,
    });
    return result.content;
  }

  private getUnsummarizedBlocks(processedUntil: string | null): Chunk[] {
    if (processedUntil) {
      return this.chunkDao.query(
        `SELECT * FROM semantic_chunks WHERE (ai_summary IS NULL OR ai_summary = '') AND updated_at > ?`,
        [processedUntil],
      ) as Chunk[];
    }
    return this.chunkDao.query(
      `SELECT * FROM semantic_chunks WHERE ai_summary IS NULL OR ai_summary = ''`,
    ) as Chunk[];
  }
}