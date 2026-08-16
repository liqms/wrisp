import { TaskExecutor, TaskContext, TaskResult } from "../types";
import { conceptDao } from "@/main/core/db/concept.dao";
import { conceptChunkDao } from "@/main/core/db/conceptChunk.dao";
import { topicDao } from "@/main/core/db/topic.dao";
import { topicConceptDao } from "@/main/core/db/topicConcept.dao";
import { topicChunkDao } from "@/main/core/db/topicChunk.dao";
import { progressManager } from "@/main/core/smart-tasks/progress.manager";
import { Concept, TopicCreate } from "@/main/types/db";
import { Logger } from "@/main/utils/logger";

export class TopicDetectionExecutor implements TaskExecutor {
  public name = "topic-detection";
  public dependencies = ["concept-extract"];

  public async run(context: TaskContext): Promise<TaskResult> {
    const concepts = conceptDao.findAll() as Concept[];
    const total = concepts.length;

    if (total < 3) {
      return { taskName: this.name, success: true, processedCount: 0, summary: { reason: "概念不足，跳过聚类" } };
    }

    try {
      // 简单聚类：按概念名首字母分组作为模拟聚类
      const clusters = this.simpleCluster(concepts);

      let processed = 0;
      for (const [, group] of clusters) {
        if (context.cancelSignal.cancelled) {
          return { taskName: this.name, success: false, processedCount: processed, error: "已取消" };
        }

        if (group.length < 2) continue;

        const topicName = group.map((c) => c.title).slice(0, 3).join(" · ");
        const topicCreate: TopicCreate = {
          title: topicName,
          summary: "",
          status: "active",
        };
        const topic = topicDao.create(topicCreate);

        for (const concept of group) {
          try {
            topicConceptDao.create({ topic_id: topic, concept_id: concept.id });
          } catch { /* 忽略重复 */ }
        }

        // 获取概念关联的 block 并建立 topic_chunks 关联
        for (const concept of group) {
          const conceptChunks = conceptChunkDao.findBy('concept_id', concept.id);
          for (const cc of conceptChunks) {
            try {
              topicChunkDao.create({ topic_id: topic, chunk_id: cc.chunk_id });
            } catch { /* 忽略重复 */ }
          }
        }

        processed++;
        progressManager.update(this.name, processed, clusters.size);
      }

      return { taskName: this.name, success: true, processedCount: processed, summary: { clusters: clusters.size, topics: processed } };
    } catch (error) {
      Logger.error("[TopicDetectionExecutor] 聚类失败", { error: String(error) });
      return { taskName: this.name, success: false, processedCount: 0, error: String(error) };
    }
  }

  /** 简单概念聚类：按名称首字母分组 */
  private simpleCluster(concepts: Concept[]): Map<string, Concept[]> {
    const clusters = new Map<string, Concept[]>();
    for (const c of concepts) {
      const key = c.title.charAt(0).toLowerCase();
      if (!clusters.has(key)) clusters.set(key, []);
      clusters.get(key)!.push(c);
    }
    return clusters;
  }
}