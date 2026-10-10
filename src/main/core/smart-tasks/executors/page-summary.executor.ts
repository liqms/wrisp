import { TaskExecutor, TaskContext, TaskResult } from "../types";
import { PageDao, ChunkDao, FileIndexDao } from "@/main/core/db";
import { aiService } from "@/main/core/services/ai/ai.service";
import { fileService } from "@/main/core/services/base/file.service";
import { progressManager } from "@/main/core/smart-tasks/progress.manager";
import { Page, Chunk } from "@/main/types/db";
import { Logger } from "@/main/utils/logger";
import { TASK_TYPE } from "@/shared/enums";
import { mapWithConcurrency } from "../concurrency";
import { localAiManager } from "@/main/core/model-gateway/local-gateway";
import { countProseWords } from "@/main/core/services/content/splitting/text";
import { CHUNK_SUMMARY_MIN_PROSE_WORDS } from "@/main/constants";

/** 本阶段完成时要落的两列：专用标记供增量选取，共用标记仅供观测 */
const STAGE_COLUMNS = [
  "last_summary_generated_at",
  "last_smart_processed_at",
] as const;

/** 短内容直接回显原文的字符上限 */
const VERBATIM_MAX_CHARS = 200;

/**
 * 页面级摘要执行器（整页粒度，chunk 级摘要的粗粒度补充）。
 *
 * chunk-summary 只解决「块在讲什么」；页面级摘要解决「这一页在讲什么」，
 * 供页面向量（page-vectorize）嵌入与「定位到哪一页」的粗召回使用。
 *
 * 输入优先复用上游 chunk-summary 的成果（聚合本页各块的 ai_summary），
 * 无块摘要时回退读页面 md 原文，避免重复烧一遍 LLM。
 */
export class PageSummaryExecutor implements TaskExecutor {
  public name = "page-summary";
  // 依赖块级摘要：页面摘要的输入是各块摘要，上游没跑完就聚合不出内容
  public dependencies: string[] = ["chunk-summary"];

  private pageDao = new PageDao();
  private chunkDao = new ChunkDao();
  private fileIndexDao = new FileIndexDao();

  public async run(context: TaskContext): Promise<TaskResult> {
    // 选取用本阶段专属的 last_summary_generated_at（与 chunk-summary 同形）：
    // 页面正文改动后 updated_at 前进，自动重入。
    const pages = this.getPendingPages();
    const total = pages.length;

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
      pages,
      limit,
      async (page) => {
        try {
          const input = this.collectInputText(page);
          if (countProseWords(input) < CHUNK_SUMMARY_MIN_PROSE_WORDS) {
            // 空页面 / 纯围栏：没有可供概括的文字，标记后即视为完成
            this.pageDao.recordStage(page.id, STAGE_COLUMNS);
            skipped++;
            processed++;
          } else {
            const summary = await this.generateSummary(input);
            // 摘要走 update()：它是页面的派生列，刷新 updated_at 让下游
            // page-vectorize 把「摘要刚生成」当作一次需要重跑的变更。
            // 顺序要紧：先 update 再写标记，标记才会 >= 水位线。
            this.pageDao.update(page.id, { ai_summary: summary });
            this.pageDao.recordStage(page.id, STAGE_COLUMNS);
            processed++;
          }
        } catch (error) {
          // 失败既不留摘要也不写标记，下一轮由选取条件自然重试
          failed++;
          Logger.error("[PageSummaryExecutor] 生成页面摘要失败", {
            pageId: page.id,
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
      Logger.info("[PageSummaryExecutor] 跳过无正文可摘要的页面", {
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

  private async generateSummary(input: string): Promise<string> {
    if (input.length <= VERBATIM_MAX_CHARS) {
      return input;
    }

    const prompt = `请用1-2句话概括以下页面内容的核心要点：\n\n${input}\n\n摘要：`;
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

  /**
   * 取本页用于摘要的输入文本：优先聚合各块摘要，无摘要时回退读 md 原文。
   * 页面正文以 chunk_type='page' 落在 semantic_chunks，按 file_id 关联
   * （page.file_path → file_index → file_id）。
   */
  private collectInputText(page: Page): string {
    const summaries = this.collectChunkSummaries(page);
    if (summaries) return summaries;

    try {
      if (fileService.exists(page.file_path)) {
        return fileService.readFile(page.file_path);
      }
    } catch (error) {
      Logger.warn("[PageSummaryExecutor] 读取页面原文失败", {
        pageId: page.id,
        error: String(error),
      });
    }
    return "";
  }

  private collectChunkSummaries(page: Page): string {
    const index = this.fileIndexDao.findByFilePath(page.file_path);
    if (!index) return "";

    const chunks = this.chunkDao.query(
      `SELECT * FROM semantic_chunks WHERE file_id = ? AND status = 'active' ORDER BY start_line ASC`,
      [index.id],
    ) as Chunk[];

    return chunks
      .map((chunk) => chunk.ai_summary?.trim())
      .filter((summary): summary is string => Boolean(summary))
      .join("\n");
  }

  private getPendingPages(): Page[] {
    return this.pageDao.query(
      `SELECT * FROM pages WHERE status = 'active' AND (last_summary_generated_at IS NULL OR updated_at > last_summary_generated_at)`,
    ) as Page[];
  }
}
