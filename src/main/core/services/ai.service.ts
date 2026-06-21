import { LLMGateway } from "@/main/core/model-gateway/llm-gateway";
import { modelRouter } from "@/main/core/model-gateway/router";
import { localGateway } from "@/main/core/model-gateway/local-gateway";
import { modelService } from "@/main/core/services/model.service";
import { configService } from "@/main/core/services/config.service";
import { LLMRequest, LLMResponse, LLMStreamChunk, CostSummary, CostRecord } from "@/main/core/model-gateway/llm-gateway/types";
import { Logger } from "@/main/utils/logger";

class AIService {
  private static instance: AIService | null = null;
  private gateway: LLMGateway | null = null;

  private constructor() { }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  private ensureGateway(): LLMGateway {
    if (!this.gateway) {
      const appConfig = configService.getConfig();
      const modelConfig = modelService.getConfig();
      this.gateway = LLMGateway.fromModelConfig(modelConfig, appConfig.failoverConfig);
    }
    return this.gateway;
  }

  async chatCompletion(request: LLMRequest): Promise<LLMResponse> {
    // 如果请求携带 taskType，使用路由器决策
    if (request.taskType) {
      const target = await modelRouter.route(request.taskType);
      if (target === "local") {
        return this.localChatCompletion(request);
      }
    }
    // 默认走云端
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
    const modelConfig = modelService.getConfig();
    if (this.gateway) {
      this.gateway.refreshConfig(modelConfig);
    } else {
      this.gateway = LLMGateway.fromModelConfig(modelConfig, appConfig.failoverConfig);
    }
  }

  /** 本地 AI 是否可用 */
  async isLocalAvailable(): Promise<boolean> {
    return modelRouter.isLocalAvailable();
  }

  /** 云端 AI 是否可用 */
  isCloudAvailable(): boolean {
    return modelRouter.isCloudAvailable();
  }

  /** 获取所有任务类型的路由状态 */
  async getRouteStatus() {
    return modelRouter.getAllRouteStatus();
  }

  /** 本地模型推理（调用 local-gateway） */
  private async localChatCompletion(request: LLMRequest): Promise<LLMResponse> {
    Logger.info("[AIService] 使用本地模型推理", { taskType: request.taskType });
    const prompt = request.messages.map((m) => `${m.role}: ${m.content}`).join("\n");
    const result = await localGateway.generate(prompt);
    return {
      id: `local-${Date.now()}`,
      model: "local",
      providerId: "local",
      content: result,
      finishReason: "stop",
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
    };
  }
}

export const aiService = AIService.getInstance();
export default AIService;