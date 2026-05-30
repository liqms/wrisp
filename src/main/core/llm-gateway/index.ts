import { LLMRequest, LLMResponse, LLMStreamChunk, LLMGatewayConfig } from "./types";
import { AppConfig } from "@/shared/types/config.types";
import { ProviderManager } from "./providers/provider-manager";
import { ModelSelector } from "./router/model-selector";
import { FailoverHandler } from "./router/failover-handler";
import { LoadBalancer } from "./router/load-balancer";
import { CostTracker } from "./utils/cost-tracker";
import { GatewayLogger } from "./utils/logger";

export class LLMGateway {
  private providerManager: ProviderManager;
  private modelSelector: ModelSelector;
  private failoverHandler: FailoverHandler;
  private loadBalancer: LoadBalancer;
  private costTracker: CostTracker;

  constructor(config: LLMGatewayConfig) {
    this.providerManager = new ProviderManager(config.providers, config.providerPriority);
    this.modelSelector = new ModelSelector(this.providerManager, config.providerPriority);
    this.failoverHandler = new FailoverHandler(config.failoverConfig, this.providerManager, this.modelSelector);
    this.loadBalancer = new LoadBalancer(this.providerManager);
    this.costTracker = new CostTracker();

    GatewayLogger.info("LLM Gateway 初始化完成", {
      providerCount: config.providers.length,
      priorityProviders: config.providerPriority,
    });
  }

  static fromAppConfig(appConfig: AppConfig): LLMGateway {
    return new LLMGateway({
      providers: appConfig.aiProviders,
      providerPriority: appConfig.providerPriority,
      failoverConfig: appConfig.failoverConfig,
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
    const adapter = this.modelSelector.select(request);
    if (!adapter) {
      throw new Error("NO_AVAILABLE_PROVIDER: 无可用 AI Provider");
    }

    const providerId = adapter.getProviderId();
    GatewayLogger.info("chatCompletionStream 开始", {
      model: request.model || "auto",
      provider: providerId,
    });

    try {
      for await (const chunk of adapter.chatCompletionStream(request)) {
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
    } catch (error) {
      GatewayLogger.error("chatCompletionStream 错误", { error: String(error) });
      throw error;
    }

    GatewayLogger.info("chatCompletionStream 完成", { provider: providerId });
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

  refreshConfig(appConfig: AppConfig): void {
    this.providerManager.refreshAll(appConfig.aiProviders, appConfig.providerPriority);
    this.costTracker.reset();
    GatewayLogger.info("LLM Gateway 配置已刷新");
  }
}