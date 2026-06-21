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

  static fromModelConfig(modelConfig: ModelConfig, failoverConfig: { maxRetries: number; retryDelayMs: number; circuitBreakerThreshold: number; cooldownMs: number }): LLMGateway {
    return new LLMGateway({
      providers: modelConfig.aiProviders,
      providerPriority: modelConfig.providerPriority,
      defaultModels: modelConfig.defaultModels,
      failoverConfig,
    });
  }

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

  getCostSummary() {
    return this.costTracker.getSummary();
  }

  getCostRecords(count?: number) {
    return this.costTracker.getRecentRecords(count);
  }

  getProviderManager(): ProviderManager {
    return this.providerManager;
  }

  refreshConfig(modelConfig: ModelConfig): void {
    this.providerManager.refreshAll(modelConfig.aiProviders, modelConfig.providerPriority);
    this.modelSelector.updateDefaultModels(modelConfig.defaultModels);
    this.modelSelector.updateProviderPriority(modelConfig.providerPriority);
    this.costTracker.reset();
    GatewayLogger.info("LLM Gateway 配置已刷新");
  }
}