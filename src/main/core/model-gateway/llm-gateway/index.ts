import { LLMRequest, LLMResponse, LLMStreamChunk, LLMGatewayConfig } from "./types";
import { ModelConfig } from "@/shared/types/model.types";
import { ProviderManager } from "./providers/provider-manager";
import { ModelSelector } from "./router/model-selector";
import { FailoverHandler } from "./router/failover-handler";
import { CostTracker } from "./utils/cost-tracker";
import { GatewayLogger } from "./utils/logger";

export class LLMGateway {
  private providerManager: ProviderManager;
  private modelSelector: ModelSelector;
  private failoverHandler: FailoverHandler;
  private costTracker: CostTracker;

  /** 初始化 LLM Gateway，创建 ProviderManager、ModelSelector、FailoverHandler、CostTracker */
  constructor(config: LLMGatewayConfig) {
    this.providerManager = new ProviderManager(config.providers, config.providerPriority);
    this.modelSelector = new ModelSelector(this.providerManager, config.providerPriority, config.defaultModels);
    this.failoverHandler = new FailoverHandler(config.failoverConfig, this.providerManager, this.modelSelector);
    this.costTracker = new CostTracker();

    GatewayLogger.info("LLM Gateway 初始化完成", {
      providerCount: config.providers.length,
      priorityProviders: config.providerPriority,
      defaultModelsCount: config.defaultModels.length,
    });
  }

  /** 从 ModelConfig 工厂方法创建 LLMGateway 实例 */
  static fromModelConfig(modelConfig: ModelConfig, failoverConfig: { maxRetries: number; retryDelayMs: number; circuitBreakerThreshold: number; cooldownMs: number }): LLMGateway {
    return new LLMGateway({
      providers: modelConfig.aiProviders,
      providerPriority: modelConfig.providerPriority,
      defaultModels: modelConfig.defaultModels,
      failoverConfig,
    });
  }

  /** 执行非流式聊天补全调用，自动处理故障转移和用量记录 */
  async chatCompletion(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    GatewayLogger.info("chatCompletion 请求", {
      model: request.model || "auto",
      messageCount: request.messages.length,
    });

    const response = await this.failoverHandler.execute(request);

    this.costTracker.record(
      response.providerId,
      response.model,
      response.usage.promptTokens,
      response.usage.completionTokens,
    );

    GatewayLogger.info("chatCompletion 完成", {
      model: response.model,
      provider: response.providerId,
      durationMs: Date.now() - startTime,
      tokens: response.usage.totalTokens,
    });

    return response;
  }

  /** 执行流式聊天补全调用，逐块 yield 响应内容 */
  async *chatCompletionStream(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    const { providerId, chunks } = await this.failoverHandler.executeStream(request, async (adapter, req) => {
      const results: LLMStreamChunk[] = [];
      for await (const chunk of adapter.chatCompletionStream(req)) {
        results.push(chunk);
      }
      return results;
    });

    for (const chunk of chunks) {
      if (chunk.usage) {
        this.costTracker.record(
          providerId,
          request.model || "unknown",
          chunk.usage.promptTokens,
          chunk.usage.completionTokens,
        );
      }
      yield chunk;
    }
  }

  /** 获取 Token 用量汇总 */
  getCostSummary() {
    return this.costTracker.getSummary();
  }

  /** 获取最近 N 条 Token 用量记录 */
  getCostRecords(count?: number) {
    return this.costTracker.getRecentRecords(count);
  }

  /** 获取 ProviderManager 实例 */
  getProviderManager(): ProviderManager {
    return this.providerManager;
  }

  /** 刷新配置（Provider、默认模型等） */
  refreshConfig(modelConfig: ModelConfig): void {
    this.providerManager.refreshAll(modelConfig.aiProviders, modelConfig.providerPriority);
    this.modelSelector.updateDefaultModels(modelConfig.defaultModels);
    this.modelSelector.updateProviderPriority(modelConfig.providerPriority);
    this.costTracker.reset();
    GatewayLogger.info("LLM Gateway 配置已刷新");
  }
}