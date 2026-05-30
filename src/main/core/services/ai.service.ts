import { LLMGateway } from "@/main/core/llm-gateway";
import { configService } from "@/main/core/services/config.service";
import { LLMRequest, LLMResponse, LLMStreamChunk, CostSummary, CostRecord } from "@/main/core/llm-gateway/types";

class AIService {
  private static instance: AIService | null = null;
  private gateway: LLMGateway | null = null;

  private constructor() {}

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  private ensureGateway(): LLMGateway {
    if (!this.gateway) {
      const appConfig = configService.getConfig();
      this.gateway = LLMGateway.fromAppConfig(appConfig);
    }
    return this.gateway;
  }

  async chatCompletion(request: LLMRequest): Promise<LLMResponse> {
    return this.ensureGateway().chatCompletion(request);
  }

  async *chatCompletionStream(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    yield* this.ensureGateway().chatCompletionStream(request);
  }

  getCostSummary(): CostSummary {
    return this.ensureGateway().getCostSummary();
  }

  getCostRecords(count?: number): CostRecord[] {
    return this.ensureGateway().getCostRecords(count);
  }

  getProviders() {
    return this.ensureGateway().getProviderManager().getAllAdapters().map(info => ({
      providerId: info.providerId,
      providerName: info.provider.name,
      models: info.models,
      isHealthy: info.isHealthy,
      enabled: info.provider.enabled,
    }));
  }

  async testProviderConnection(providerId: string): Promise<boolean> {
    const adapter = this.ensureGateway().getProviderManager().getAdapterByProvider(providerId);
    if (!adapter) return false;
    return adapter.testConnection();
  }

  refreshConfig(): void {
    const appConfig = configService.getConfig();
    if (this.gateway) {
      this.gateway.refreshConfig(appConfig);
    } else {
      this.gateway = LLMGateway.fromAppConfig(appConfig);
    }
  }
}

export const aiService = AIService.getInstance();
export default AIService;