import { TaskExecutor, TaskContext, TaskResult } from "../types";
import { PageDao } from "@/main/core/db";
import { vectorService } from "@/main/core/services/ai/vector.service";
import {
  buildPageEmbeddings,
  buildPageEmbeddingText,
} from "@/main/core/vector/vector-payload";
import { localGateway } from "@/main/core/model-gateway/local-gateway";
import { progressManager } from "@/main/core/smart-tasks/progress.manager";
import { Page } from "@/main/types/db";
import { Logger } from "@/main/utils/logger";

/**
 * 页面向量化执行器（整页粒度）。
 *
 * 与 chunk-vectorize 的分工：chunk 向量用于精确定位到块，页面向量用于
 * 「定位到哪一页」的粗召回。嵌入文本取页面摘要（page-summary 的产物），
 * 无条件挂 project_id 过滤（直接取 pages.project_id，可空）。
 */
export class PageVectorizeExecutor implements TaskExecutor {
  public name = "page-vectorize";
  // 依赖页面摘要：嵌入文本取自 ai_summary，上游没跑完就嵌不到有意义的文本
  public dependencies = ["page-summary"];

  private pageDao = new PageDao();

  public async run(context: TaskContext): Promise<TaskResult> {
    // 上游门槛读 page-summary 的**标记列**而不是 ai_summary：
    // 无正文可摘要的页面也会写标记，它们仍需进向量库（嵌入文本回退标题）
    const pages = this.getUnvectorizedPages();
    const total = pages.length;

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

    for (let i = 0; i < pages.length; i += batchSize) {
      if (context.cancelSignal.cancelled) {
        return {
          taskName: this.name,
          success: false,
          processedCount: processed,
          failedCount: failed,
          error: "已取消",
        };
      }

      const batch = pages.slice(i, i + batchSize);
      const texts = batch.map((page) => buildPageEmbeddingText(page));

      try {
        const results = await localGateway.embedBatch(texts);

        const vectorList = results.map((r) => r.vector);
        const vectors = buildPageEmbeddings(batch, vectorList);

        await vectorService.createPageEmbeddings(vectors);

        // 标记写入不刷新 updated_at，否则本页下一轮会被自己重新选中
        this.pageDao.recordStageBatch(
          batch.map((page) => page.id),
          ["last_vectorized_at", "last_smart_processed_at"],
        );

        processed += batch.length;
        progressManager.update(this.name, processed + failed, total);
      } catch (error) {
        // 失败批不写标记：下一轮重嵌，避免一次 embedding 故障就永久丢掉这批向量
        failed += batch.length;
        Logger.error("[PageVectorizeExecutor] 处理 batch 失败", {
          error: String(error),
          batch: i,
        });
      }
    }

    // success 仍表示「本阶段跑完了」：部分失败交给标记列自愈
    return {
      taskName: this.name,
      success: true,
      processedCount: processed,
      failedCount: failed,
    };
  }

  private getUnvectorizedPages(): Page[] {
    // 以上游 page-summary 的标记列为门槛，本任务专用的 last_vectorized_at 判增量；
    // 正文改过的页（updated_at 晚于标记）重嵌，软删除的墓碑页不烧算力。
    return this.pageDao.query(
      `SELECT * FROM pages
       WHERE last_summary_generated_at IS NOT NULL AND status = 'active'
         AND (last_vectorized_at IS NULL OR updated_at > last_vectorized_at)`,
    ) as Page[];
  }
}
