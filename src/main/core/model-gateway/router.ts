/**
 * Model Router — 模型路由决策核心
 * 根据任务类型、用户开关和模型源可用性，决定使用本地还是云端 AI
 */
import { TaskType, TASK_TYPE } from "@/shared/enums";
import { modelService } from "@/main/core/services/model.service";
import { modelManager } from "@/main/core/model-gateway/local-gateway/model-manager";
import type { AIProvider } from "@/shared/types/model.types";
import { Logger } from "@/main/utils/logger";

type RouteTarget = "local" | "cloud";

interface RoutingRule {
  primary: RouteTarget;
  fallback?: RouteTarget;
}

/** 任务路由规则表 */
const taskRules: Record<TaskType, RoutingRule> = {
  [TASK_TYPE.CONCEPT_NAMING]: { primary: "cloud", fallback: "local" }, // 概念命名和演化摘要任务
  [TASK_TYPE.TOPIC_SUMMARY]: { primary: "cloud", fallback: "local" }, // 主题命名与摘要任务
  [TASK_TYPE.SUMMARY]: { primary: "cloud", fallback: "local" }, // 摘要任务优
  [TASK_TYPE.REFLECTION]: { primary: "cloud", fallback: "local" }, // 反思任务
  [TASK_TYPE.REWRITE]: { primary: "cloud", fallback: "local" }, // 改写任务
  [TASK_TYPE.POLISH]: { primary: "cloud", fallback: "local" }, // 润色任务
  [TASK_TYPE.CONTINUE]: { primary: "cloud", fallback: "local" }, // 续写任务
  [TASK_TYPE.EXPAND]: { primary: "cloud", fallback: "local" }, // 扩写任务
  [TASK_TYPE.MULTIMODAL]: { primary: "cloud", fallback: "local" }, // 多模态任务
};

class ModelRouter {
  /**
   * 根据任务类型路由到 local 或 cloud
   * @param task 任务类型
   * @returns RouteTarget
   * @throws 如果首选源和备选源都不可用
   */
  public async route(task: TaskType): Promise<RouteTarget> {
    const rule = taskRules[task];
    if (!rule) throw new Error(`未知任务类型: ${task}`);

    if (await this.isSourceAvailable(rule.primary)) {
      Logger.info("[ModelRouter] 路由决策", { task, target: rule.primary });
      return rule.primary;
    }

    if (rule.fallback && await this.isSourceAvailable(rule.fallback)) {
      Logger.info("[ModelRouter] 降级路由", { task, primary: rule.primary, fallback: rule.fallback });
      return rule.fallback;
    }

    throw new Error(`没有可用的 AI 源执行任务: ${task}`);
  }

  /**
   * 检查本地 AI 是否可用
   * 判断标准：enableAiMode 开关启用 + 至少嵌入模型已下载
   */
  public async isLocalAvailable(): Promise<boolean> {
    const enabled = modelService.getValue<boolean>("enableAiMode");
    if (!enabled) return false;

    try {
      const checkResult = await modelManager.checkModelFiles("jina-embeddings-v3");
      return checkResult.complete;
    } catch {
      return false;
    }
  }

  /**
   * 检查云端 AI 是否可用
   * 判断标准：enableCloudAi 开关启用 + 至少有一个服务商
   */
  public isCloudAvailable(): boolean {
    const enabled = modelService.getValue<boolean>("enableCloudAi");
    if (enabled !== true) return false;

    const providers = modelService.getValue<AIProvider[]>("aiProviders");
    return Array.isArray(providers) && providers.some(p => p.enabled);
  }

  /**
   * 获取所有任务类型的当前路由状态
   */
  public async getAllRouteStatus(): Promise<Record<TaskType, { primary: RouteTarget; fallback?: RouteTarget; current: RouteTarget } | { error: string }>> {
    const result = {} as Record<string, unknown>;
    for (const task of Object.keys(taskRules) as TaskType[]) {
      try {
        const rule = taskRules[task];
        const current = await this.route(task);
        result[task] = { primary: rule.primary, fallback: rule.fallback, current };
      } catch (error) {
        result[task] = { error: String(error) };
      }
    }
    return result as Record<TaskType, { primary: RouteTarget; fallback?: RouteTarget; current: RouteTarget } | { error: string }>;
  }

  /** 检查模型源是否可用 */
  private async isSourceAvailable(source: RouteTarget): Promise<boolean> {
    if (source === "local") {
      return this.isLocalAvailable();
    }
    return this.isCloudAvailable();
  }
}

export default ModelRouter;
export const modelRouter = new ModelRouter();