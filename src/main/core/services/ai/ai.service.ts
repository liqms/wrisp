import { LLMGateway } from "@/main/core/model-gateway/llm-gateway";
import { modelRouter } from "@/main/core/model-gateway/router";
import { localGateway } from "@/main/core/model-gateway/local-gateway";
import { LLMConcurrencyController } from "@/main/core/model-gateway/llm-concurrency-controller";
import { modelService } from "@/main/core/services/ai/model.service";
import { configService } from "@/main/core/services/system/config.service";
import { modelMetaService } from "@/main/core/services/ai/model-meta.service";
import { LLMRequest, LLMResponse, LLMStreamChunk, CostSummary, CostRecord, Model } from "@/main/core/model-gateway/llm-gateway/types";
import type { LlmGenerateOptions } from "@/main/core/model-gateway/local-gateway/types";
import { AIProvider } from "@/shared/types/model.types";
import { Logger } from "@/main/utils/logger";

/**
 * 本地模型「跑完了但没有主回复」的统一错误。
 *
 * 思考型模型会把预算全花在 `<think>` 段上，而 node-llama-cpp 的返回值只含主回复，
 * 于是拿到空串。此前它被当成功返回：摘要任务把空值写进库、概念任务抛一个语义不明的
 * 解析错误。空产出就是推理失败，必须在源头抛出，让调用方按失败重试（设计 §3.7）。
 */
const LOCAL_EMPTY_OUTPUT = "本地模型未返回内容";

class AIService {
  private static instance: AIService | null = null;
  private gateway: LLMGateway | null = null;
  private concurrencyController = new LLMConcurrencyController(5);

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

  /**
   * 并发槽位优先级：按「是否用户在等」判定，而非「有没有 taskType」。
   * 智能整理的任务同样携带 taskType，把它们判成 high 会让抢占反过来拖慢交互请求。
   */
  private resolvePriority(request: LLMRequest): "high" | "low" {
    return request.background ? "low" : "high";
  }

  async chatCompletion(request: LLMRequest): Promise<LLMResponse> {
    const priority = this.resolvePriority(request);
    return this.concurrencyController.acquire(
      async () => {
        // 如果请求携带 taskType 且无 tools（L2 不走本地路由），使用路由器决策
        if (request.taskType && !request.tools) {
          const target = await modelRouter.route(request.taskType);
          if (target === "local") {
            return this.localChatCompletion(request);
          }
        }
        // 默认走云端
        return this.ensureGateway().chatCompletion(request);
      },
      { priority },
    );
  }

  async *chatCompletionStream(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    const priority = this.resolvePriority(request);
    const release = await this.concurrencyController.acquireSlotManual(priority);
    try {
      // 如果请求携带 taskType 且无 tools（L2 不走本地路由），使用路由器决策
      if (request.taskType && !request.tools) {
        const target = await modelRouter.route(request.taskType);
        if (target === "local") {
          yield* this.localChatCompletionStream(request);
          return;
        }
      }
      // 默认走云端
      yield* this.ensureGateway().chatCompletionStream(request);
    } finally {
      release();
    }
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

  /** 获取指定 Provider 支持的模型列表（调用厂商 /models 接口，并合并本地元信息） */
  async listModels(provider: AIProvider): Promise<Model[]> {
    const providerManager = this.ensureGateway().getProviderManager();
    // 始终用传入配置构造临时适配器，确保使用表单中当前的 API Key/接口地址
    // （新增时尚未持久化无法注册；编辑时已注册适配器仍持有旧配置）
    const adapter = providerManager.createTemporaryAdapter(provider);
    if (!adapter) {
      throw new Error(`Provider [${provider.id}] 未注册或未启用`);
    }
    const models = await adapter.listModels();
    const metaMap = modelMetaService.getProviderModels(provider.id);
    if (Object.keys(metaMap).length === 0) return models;

    return models.map((m) => {
      const meta = metaMap[m.id];
      if (!meta) return m;
      // 元信息存在时覆盖对应字段，未提供的保留适配器原值
      return {
        ...m,
        contextLength: meta.contextLength ?? m.contextLength,
        maxTokens: meta.maxTokens ?? m.maxTokens,
        isInputText: meta.isInputText ?? m.isInputText,
        isInputPic: meta.isInputPic ?? m.isInputPic,
        isInputAudio: meta.isInputAudio ?? m.isInputAudio,
        isInputVideo: meta.isInputVideo ?? m.isInputVideo,
        structuredOutputs: meta.structuredOutputs ?? m.structuredOutputs,
        outputType: meta.outputType ?? m.outputType,
      };
    });
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

  /** 组装适合本地 chat 模型的 prompt：system 消息置前，取最后一条 user 消息作为输入 */
  private buildLocalPrompt(request: LLMRequest): string {
    const systemContent = request.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const lastUser = [...request.messages].reverse().find((m) => m.role === "user");
    const prompt = [systemContent, lastUser?.content]
      .filter((part): part is string => !!part && part.trim().length > 0)
      .join("\n\n");
    if (!prompt) throw new Error("本地 LLM 未就绪：无可用的用户消息");
    return prompt;
  }

  /** 本地推理采样参数：请求缺省时留空，由 worker 侧回退 DEFAULT_LLM_CONFIG 的值 */
  private buildLocalOptions(request: LLMRequest): LlmGenerateOptions {
    return { temperature: request.temperature, maxTokens: request.maxTokens };
  }

  /** 本地模型推理（调用 local-gateway） */
  private async localChatCompletion(request: LLMRequest): Promise<LLMResponse> {
    Logger.info("[AIService] 使用本地模型推理", { taskType: request.taskType });
    const prompt = this.buildLocalPrompt(request);
    let result: string;
    try {
      result = await localGateway.generate(prompt, this.buildLocalOptions(request));
    } catch (error) {
      // 保留底层清晰错误（如「本地 LLM 加载失败：缺少模型文件路径」/「本地 LLM 未加载」）
      Logger.error("[AIService] 本地 LLM 未就绪或推理失败", { error: String(error) });
      throw error;
    }
    if (!result.trim()) {
      Logger.error("[AIService] 本地 LLM 返回空内容", { taskType: request.taskType });
      throw new Error(LOCAL_EMPTY_OUTPUT);
    }
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

  /** 本地模型流式推理：把 local-gateway 的逐 token 回调桥接为生成器 yield */
  private async *localChatCompletionStream(request: LLMRequest): AsyncIterable<LLMStreamChunk> {
    Logger.info("[AIService] 使用本地模型流式推理", { taskType: request.taskType });
    const prompt = this.buildLocalPrompt(request);

    const queue: string[] = [];
    let notify: (() => void) | null = null;
    let done = false;
    let error: unknown = null;
    // 累计已下发内容：结束时据此判断这一轮到底有没有产出
    let produced = "";

    // 唤醒正在等待的消费者（若有）
    const wake = (): void => {
      if (notify) {
        const resolve = notify;
        notify = null;
        resolve();
      }
    };

    const generation = localGateway.generateStream(
      prompt,
      this.buildLocalOptions(request),
      (token) => {
        queue.push(token);
        wake();
      },
    );
    generation.then(
      () => {
        done = true;
        wake();
      },
      (err) => {
        error = err;
        done = true;
        wake();
      },
    );

    while (true) {
      if (queue.length > 0) {
        const token = queue.shift() as string;
        produced += token;
        yield { content: token, finishReason: null, usage: null };
        continue;
      }
      if (error) throw error;
      if (done) break;
      await new Promise<void>((resolve) => {
        notify = resolve;
      });
      // await 返回后回到循环顶部，重新检查 queue / error / done，避免漏 token 或竞态
    }

    // 一个 token 也没产出：与思考型模型的「主回复为空」同源，不能当成正常结束
    if (!produced.trim()) {
      Logger.error("[AIService] 本地 LLM 流式推理无产出", { taskType: request.taskType });
      throw new Error(LOCAL_EMPTY_OUTPUT);
    }

    // 结束标记（与 openai 适配器一致：最后一个 chunk 携带 stop）
    yield { content: "", finishReason: "stop", usage: null };
  }
}

export const aiService = AIService.getInstance();
export default AIService;