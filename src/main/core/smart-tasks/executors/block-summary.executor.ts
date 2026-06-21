import { TaskExecutor, TaskContext, TaskResult } from "../types";
import { BlockDao } from "@/main/core/db";
import { localGateway } from "@/main/core/model-gateway/local-gateway";
import { progressManager } from "@/main/core/smart-tasks/progress.manager";
import { Block, BlockUpdate } from "@/main/types/db";
import { Logger } from "@/main/utils/logger";

export class BlockSummaryExecutor implements TaskExecutor {
  public name = "block-summary";
  public dependencies: string[] = [];

  private blockDao = new BlockDao();

  public async run(context: TaskContext): Promise<TaskResult> {
    const blocks = this.getUnsummarizedBlocks(context.processedUntil);
    const total = blocks.length;

    if (total === 0) {
      return { taskName: this.name, success: true, processedCount: 0 };
    }

    let processed = 0;

    for (const block of blocks) {
      if (context.cancelSignal.cancelled) {
        return { taskName: this.name, success: false, processedCount: processed, error: "已取消" };
      }

      try {
        const summary = await this.generateSummary(block);
        const update: BlockUpdate = {
          ai_summary: summary,
          last_smart_processed_at: new Date().toISOString(),
        };
        this.blockDao.update(block.id, update);

        processed++;
        progressManager.update(this.name, processed, total);
      } catch (error) {
        Logger.error("[BlockSummaryExecutor] 生成摘要失败", { blockId: block.id, error: String(error) });
        processed++;
      }
    }

    return { taskName: this.name, success: true, processedCount: processed };
  }

  private async generateSummary(block: Block): Promise<string> {
    if (block.content.length <= 200) {
      return block.content;
    }

    const prompt = `请用1-2句话概括以下内容的核心要点：\n\n${block.content}\n\n摘要：`;
    const result = await localGateway.generate(prompt);
    return result;
  }

  private getUnsummarizedBlocks(processedUntil: string | null): Block[] {
    if (processedUntil) {
      return this.blockDao.db
        .prepare(
          `SELECT * FROM blocks WHERE (ai_summary IS NULL OR ai_summary = '') AND updated_at > ?`,
        )
        .all(processedUntil) as Block[];
    }
    return this.blockDao.db
      .prepare(`SELECT * FROM blocks WHERE ai_summary IS NULL OR ai_summary = ''`)
      .all() as Block[];
  }
}