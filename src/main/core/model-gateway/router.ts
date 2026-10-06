/**
 * Model Router — 模型路由决策核心
 * 根据任务类型、用户开关和模型源可用性，决定使用本地还是云端 AI
 */
import { TaskType, TASK_TYPE } from "@/shared/enums";
import { modelService } from "@/main/core/services/ai/model.service";
import { modelManager } from "@/main/core/model-gateway/local-gateway/model-manager";
import { getFamilyMinMemoryGB, getFamilyModelId } from "@/main/core/model-gateway/local-gateway/model-registry";
import { canLoadModel } from "@/main/core/model-gateway/local-gateway/hardware";
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
   * 根据任务类型路由到 local 或 cloud。
   * 默认「云端优先」：启用云端增强且有可用 provider 时走云端，不加载本地 LLM。
   * 用户可在 localLlmTasks 中逐个指定任务走本地；本地不可用时回退云端（D4）。
   * @param task 任务类型
   * @returns RouteTarget
   * @throws 首选源与备选源都不可用
   */
  public async route(task: TaskType): Promise<RouteTarget> {
    if (!taskRules[task]) throw new Error(`未知任务类型: ${task}`);

    const preferLocal = this.getLocalLlmTasks().includes(task);

    if (preferLocal) {
      if (await this.isLocalLlmAvailable()) {
        Logger.info("[ModelRouter] 路由决策", { task, target: "local", reason: "user-preference" });
        return "local";
      }
      if (this.isCloudAvailable()) {
        Logger.info("[ModelRouter] 本地不可用，回退云端", { task });
        return "cloud";
      }
      throw new Error(`本地 LLM 不可用且云端不可用，无法执行任务: ${task}`);
    }

    if (this.isCloudAvailable()) {
      Logger.info("[ModelRouter] 路由决策", { task, target: "cloud" });
      return "cloud";
    }
    if (await this.isLocalLlmAvailable()) {
      Logger.info("[ModelRouter] 云端不可用，降级本地", { task });
      return "local";
    }
    throw new Error(`云端不可用且本地 LLM 未就绪，无法执行任务: ${task}`);
  }

  /** 读取用户指定「走本地 LLM」的任务类型列表；缺失或非法时返回空数组 */
  private getLocalLlmTasks(): TaskType[] {
    const tasks = modelService.getValue<TaskType[]>("localLlmTasks");
    return Array.isArray(tasks) ? tasks : [];
  }

  /**
   * 检查本地嵌入/重排序能力是否可用
   * 判断标准：enableAiMode 开关启用 + 嵌入模型已下载 + 可用内存足够同时驻留两类模型
   */
  public async isLocalEmbeddingAvailable(): Promise<boolean> {
    const enabled = modelService.getValue<boolean>("enableAiMode");
    if (!enabled) return false;

    try {
      const embeddingId = getFamilyModelId("embedding");
      if (!embeddingId) return false;
      const checkResult = await modelManager.checkModelFiles(embeddingId);
      if (!checkResult.complete) return false;

      // 语义搜索需同时驻留嵌入 + 重排序模型；可用内存不足时宁可降级 FTS5，
      // 也不要硬加载数 GB 权重拖垮机器。
      const requiredGB = getFamilyMinMemoryGB("embedding") + getFamilyMinMemoryGB("reranker");
      if (!canLoadModel(requiredGB)) {
        Logger.info("[ModelRouter] 可用内存不足，跳过本地语义能力", { requiredGB });
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 检查本地 AI（嵌入能力）是否可用
   * 保持原语义，wiki 智能整理的 gate 依赖此返回值
   */
  public async isLocalAvailable(): Promise<boolean> {
    return this.isLocalEmbeddingAvailable();
  }

  /**
   * 检查本地 LLM 生成能力是否可用
   * 判断标准：enableAiMode 开关启用 + 可用内存足够 + LLM 模型已下载
   */
  public async isLocalLlmAvailable(): Promise<boolean> {
    const enabled = modelService.getValue<boolean>("enableAiMode");
    if (!enabled) return false;

    // 与 isLocalEmbeddingAvailable 对齐：内存不足时不选中本地 LLM，避免加载后卡死（P6）
    const requiredGB = getFamilyMinMemoryGB("llm");
    if (!canLoadModel(requiredGB)) {
      Logger.info("[ModelRouter] 可用内存不足，跳过本地 LLM", { requiredGB });
      return false;
    }

    try {
      const checkResult = await modelManager.checkModelFiles("qwen3.5-4b");
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
}

export default ModelRouter;
export const modelRouter = new ModelRouter();