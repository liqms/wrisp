import { TaskExecutor, TaskContext, TaskResult } from "../types";
import { BlockDao } from "@/main/core/db";
import { conceptDao } from "@/main/core/db/concept.dao";
import { conceptBlockDao } from "@/main/core/db/conceptBlock.dao";
import { localGateway } from "@/main/core/model-gateway/local-gateway";
import { progressManager } from "@/main/core/smart-tasks/progress.manager";
import { Block, BlockUpdate } from "@/main/types/db";
import { ConceptCreate, ConceptBlockCreate } from "@/main/types/db";
import { Logger } from "@/main/utils/logger";

export class ConceptExtractExecutor implements TaskExecutor {
  public name = "concept-extract";
  public dependencies = ["block-summary", "block-vectorize"];

  private blockDao = new BlockDao();

  public async run(context: TaskContext): Promise<TaskResult> {
    const blocks = this.getUnprocessedBlocks(context.processedUntil);
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
        const summary = block.ai_summary || block.content;
        const concepts = await this.extractConcepts(summary);

        for (const conceptName of concepts) {
          // 查找或创建概念
          let concept = conceptDao.findByName(conceptName);
          if (!concept) {
            const create: ConceptCreate = { name: conceptName, description: "" };
            concept = conceptDao.create(create);
          }

          // 建立关联
          try {
            const cbCreate: ConceptBlockCreate = {
              concept_id: concept.id,
              block_id: block.id,
            };
            conceptBlockDao.create(cbCreate);
          } catch {
            // 可能已存在关联，忽略
          }
        }

        const update: BlockUpdate = { last_smart_processed_at: new Date().toISOString() };
        this.blockDao.update(block.id, update);

        processed++;
        progressManager.update(this.name, processed, total);
      } catch (error) {
        Logger.error("[ConceptExtractExecutor] 提取失败", { blockId: block.id, error: String(error) });
        processed++;
      }
    }

    return { taskName: this.name, success: true, processedCount: processed };
  }

  private async extractConcepts(text: string): Promise<string[]> {
    const prompt = `从以下文本中提取3-5个核心概念，每个概念用1-3个词表达，用逗号分隔：\n\n${text}\n\n概念：`;
    const result = await localGateway.generate(prompt);
    return result
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length < 50);
  }

  private getUnprocessedBlocks(processedUntil: string | null): Block[] {
    if (processedUntil) {
      return this.blockDao.db
        .prepare(
          `SELECT * FROM blocks WHERE updated_at > ?`,
        )
        .all(processedUntil) as Block[];
    }
    return this.blockDao.db.prepare(`SELECT * FROM blocks`).all() as Block[];
  }
}