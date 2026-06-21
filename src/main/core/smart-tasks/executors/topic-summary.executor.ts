import { TaskExecutor, TaskContext, TaskResult } from "../types";
import { topicDao } from "@/main/core/db/topic.dao";
import { localGateway } from "@/main/core/model-gateway/local-gateway";
import { progressManager } from "@/main/core/smart-tasks/progress.manager";
import { Topic, TopicUpdate } from "@/main/types/db";
import { Logger } from "@/main/utils/logger";

export class TopicSummaryExecutor implements TaskExecutor {
  public name = "topic-summary";
  public dependencies = ["topic-detection"];

  public async run(context: TaskContext): Promise<TaskResult> {
    const topics = topicDao.findAll() as Topic[];
    const total = topics.length;

    if (total === 0) {
      return { taskName: this.name, success: true, processedCount: 0 };
    }

    let processed = 0;

    for (const topic of topics) {
      if (context.cancelSignal.cancelled) {
        return { taskName: this.name, success: false, processedCount: processed, error: "已取消" };
      }

      try {
        const summary = await this.generateTopicSummary(topic);
        const update: TopicUpdate = { summary };
        topicDao.update(topic.id, update);

        processed++;
        progressManager.update(this.name, processed, total);
      } catch (error) {
        Logger.error("[TopicSummaryExecutor] 生成摘要失败", { topicId: topic.id, error: String(error) });
        processed++;
      }
    }

    return { taskName: this.name, success: true, processedCount: processed };
  }

  private async generateTopicSummary(topic: Topic): Promise<string> {
    const prompt = `请用1-2句话概括以下主题的核心内容：\n\n主题：${topic.name}\n描述：${topic.description || "暂无"}\n\n摘要：`;
    const result = await localGateway.generate(prompt);
    return result;
  }
}