import { TaskExecutor, TaskContext, TaskResult } from "../types";
import { ChunkDao } from "@/main/core/db";
import { conceptDao } from "@/main/core/db/concept.dao";
import { conceptChunkDao } from "@/main/core/db/conceptChunk.dao";
import { aiService } from "@/main/core/services/ai/ai.service";
import { progressManager } from "@/main/core/smart-tasks/progress.manager";
import { Chunk } from "@/main/types/db";
import { Logger } from "@/main/utils/logger";
import { TASK_TYPE } from "@/shared/enums";
import { mapWithConcurrency } from "../concurrency";
import { localAiManager } from "@/main/core/model-gateway/local-gateway";
import { getSmartTaskConfig } from "../smart-task.config";
import { normalizeConceptTitle } from "@/shared/utils";
import {
  CONCEPT_CANDIDATE_POOL,
  CONCEPT_CANDIDATES_PER_BLOCK,
  CONCEPT_MAX_OUTPUT_TOKENS,
  CONCEPT_TEMPERATURE,
} from "@/main/constants/concept.constants";
import {
  buildConceptMessages,
  isGeneralConcept,
  parseConceptJson,
  type ParsedConcept,
} from "./concept-input";

/** 单块对某概念的最高把握度（同块重复提及取最大值） */
type MentionByChunk = Map<string, number>;

interface AggregatedConcept {
  titleKey: string;
  /** 代表写法：本轮置信度最高的那次输出的 title */
  title: string;
  /** title 对应的置信度，跨块比较用 */
  topConfidence: number;
  /** 原始别名写法，按归一化键去重 */
  aliases: string[];
  mentions: MentionByChunk;
}

/**
 * 概念抽取。
 *
 * 两阶段设计（§3.1.3）：块级抽取可以并发，但「查—建—关联」必须串行，
 * 否则并发 2 以上会让同义概念各建一行 —— 这正是概念列表膨胀的根因。
 * 阶段 1 把结果聚合进执行级内存 Map，阶段 2 按 title_key 逐条 upsert。
 */
export class ConceptExtractExecutor implements TaskExecutor {
  public name = "concept-extract";
  public dependencies = ["chunk-summary", "chunk-vectorize"];

  private chunkDao = new ChunkDao();

  public async run(context: TaskContext): Promise<TaskResult> {
    const blocks = this.getUnextractedBlocks();
    const total = blocks.length;

    if (total === 0) {
      return {
        taskName: this.name,
        success: true,
        processedCount: 0,
        failedCount: 0,
      };
    }

    // 候选池每轮取一次，块与块之间轮换切片：既控制 prompt 体积，又让整池有机会被复用
    const pool = conceptDao.recentTitles(CONCEPT_CANDIDATE_POOL);
    const aggregated = new Map<string, AggregatedConcept>();
    let processed = 0;
    let failed = 0;
    const limit = Math.max(1, localAiManager.getLlmConcurrency());

    await mapWithConcurrency(
      blocks,
      limit,
      async (block, index) => {
        try {
          const concepts = await this.extractFromBlock(block, pool, index);
          for (const concept of concepts) {
            this.aggregate(aggregated, block.id, concept);
          }
          this.markProcessed(block.id);
          processed++;
        } catch (error) {
          // 解析/推理失败：不写标记列，下一轮自然重抽（设计 D8）
          failed++;
          Logger.error("[ConceptExtractExecutor] 提取失败", {
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

    const persisted = this.persistAggregated(aggregated);
    Logger.info("[ConceptExtractExecutor] 本轮概念落库完成", {
      blocks: processed,
      failed,
      concepts: aggregated.size,
      persisted,
    });

    return {
      taskName: this.name,
      success: true,
      processedCount: processed,
      failedCount: failed,
    };
  }

  /**
   * 阶段 2：按归一化键串行落库。
   * @returns 本轮落库的概念条数
   */
  private persistAggregated(aggregated: Map<string, AggregatedConcept>): number {
    for (const concept of aggregated.values()) {
      const confidences = [...concept.mentions.values()];
      const relevance = confidences.reduce((sum, value) => sum + value, 0) / confidences.length;

      const { id } = conceptDao.upsertByTitleKey({
        titleKey: concept.titleKey,
        title: concept.title,
        aliases: concept.aliases,
        mentionDelta: concept.mentions.size,
        relevance,
      });
      if (!id) {
        Logger.warn("[ConceptExtractExecutor] 概念 upsert 后未取回 id", {
          titleKey: concept.titleKey,
        });
        continue;
      }

      for (const [chunkId, confidence] of concept.mentions) {
        conceptChunkDao.upsertAssociation(id, chunkId, confidence);
      }
      // 关联写完再校准计数：mention_count 是 concept_chunks 行数的派生值。
      // 靠 upsert 累加会在「全量重抽」里翻倍（同一块被数两次：去重汇总 + 本轮重跑）
      conceptDao.syncMentionCount(id);
    }
    return aggregated.size;
  }

  private async extractFromBlock(
    block: Chunk,
    pool: string[],
    index: number,
  ): Promise<ParsedConcept[]> {
    const messages = buildConceptMessages(
      block,
      getSmartTaskConfig().conceptInputWindowChars,
      this.pickCandidates(pool, index),
    );

    const result = await aiService.chatCompletion({
      messages: [
        { role: "system", content: messages.system },
        { role: "user", content: messages.user },
      ],
      taskType: TASK_TYPE.CONCEPT_NAMING,
      temperature: CONCEPT_TEMPERATURE,
      maxTokens: CONCEPT_MAX_OUTPUT_TOKENS,
      background: true,
    });

    return parseConceptJson(result.content).filter((concept) => !isGeneralConcept(concept.title));
  }

  /** 从候选池按块序号轮换取一段，池小于每块条数时直接整池 */
  private pickCandidates(pool: string[], index: number): string[] {
    if (pool.length <= CONCEPT_CANDIDATES_PER_BLOCK) return pool;
    const start = (index * CONCEPT_CANDIDATES_PER_BLOCK) % pool.length;
    const doubled = [...pool, ...pool];
    return doubled.slice(start, start + CONCEPT_CANDIDATES_PER_BLOCK);
  }

  private aggregate(
    aggregated: Map<string, AggregatedConcept>,
    chunkId: string,
    concept: { title: string; aliases: string[]; confidence: number },
  ): void {
    const titleKey = normalizeConceptTitle(concept.title);
    if (!titleKey) return;

    const existing = aggregated.get(titleKey);
    if (!existing) {
      const aliasKeys = new Set<string>();
      const aliases: string[] = [];
      for (const alias of concept.aliases) {
        const key = normalizeConceptTitle(alias);
        if (!key || key === titleKey || aliasKeys.has(key)) continue;
        aliasKeys.add(key);
        aliases.push(alias);
      }
      aggregated.set(titleKey, {
        titleKey,
        title: concept.title,
        topConfidence: concept.confidence,
        aliases,
        mentions: new Map([[chunkId, concept.confidence]]),
      });
      return;
    }

    const previous = existing.mentions.get(chunkId) ?? 0;
    existing.mentions.set(chunkId, Math.max(previous, concept.confidence));
    // 代表写法取本轮置信度最高的输出，避免同一概念在不同块里各留一种措辞
    if (concept.confidence > existing.topConfidence) {
      existing.title = concept.title;
      existing.topConfidence = concept.confidence;
    }
    for (const alias of concept.aliases) {
      const key = normalizeConceptTitle(alias);
      if (!key || key === existing.titleKey) continue;
      if (existing.aliases.some((item) => normalizeConceptTitle(item) === key)) continue;
      existing.aliases.push(alias);
    }
  }

  /**
   * 阶段标记写概念专属列，另附观测列「最后被任一智能任务触碰」。
   * 走 recordStage 而不是 update()：后者会刷新 updated_at，让本块下一轮又被自己选中。
   */
  private markProcessed(blockId: string): void {
    this.chunkDao.recordStage(blockId, [
      "last_concept_extracted_at",
      "last_smart_processed_at",
    ]);
  }

  private getUnextractedBlocks(): Chunk[] {
    // 只认概念阶段自己的标记列：updated_at 晚于标记即正文变过，需要重抽
    return this.chunkDao.query(
      `SELECT * FROM semantic_chunks
       WHERE status = 'active'
         AND (last_concept_extracted_at IS NULL OR updated_at > last_concept_extracted_at)`,
    ) as Chunk[];
  }
}
