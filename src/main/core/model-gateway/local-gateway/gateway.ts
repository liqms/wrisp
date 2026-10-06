/**
 * Local Gateway — 本地 AI 统一推理入口
 * 封装 Embedding 和 Reranker 的调用，自动管理模型生命周期和空闲卸载
 */
import { localAiManager } from "./manager";
import { modelManager } from "./model-manager";
import { getFamilyModelId } from "./model-registry";
import { EmbeddingResult, EmbeddingConfig, RerankResult, RerankConfig, LlmGenerateOptions, DEFAULT_LLM_CONFIG } from "./types";
import { Logger } from "@/main/utils/logger";

/** 搜索模型空闲保留期：搜索是高频短任务，冷启动（加载 2.3GB + 1.8GB）远贵于常驻 */
const SEARCH_MODEL_KEEPALIVE_MS = 30 * 60 * 1000;

export interface GatewayEmbedOptions {
  modelId?: string;
  pooling?: string;
  normalize?: boolean;
  batchSize?: number;
}

export interface GatewayRerankOptions {
  modelId?: string;
  topN?: number;
}

class LocalGateway {
  /**
   * 对单个文本进行向量嵌入
   */
  public async embed(
    text: string,
    config?: Partial<EmbeddingConfig>,
  ): Promise<EmbeddingResult> {
    try {
      if (config) {
        await localAiManager.ensureEmbeddingModel(config);
      }
      const embeddingId = getFamilyModelId("embedding");
      if (embeddingId) modelManager.touchModel(embeddingId);

      const result = await localAiManager.embed(
        text,
        config?.pooling,
        config?.normalize,
      );
      return result;
    } catch (error) {
      Logger.error("[LocalGateway] 嵌入失败", { error: String(error), text });
      throw error;
    }
  }

  /**
   * 对批量文本进行向量嵌入
   */
  public async embedBatch(
    texts: string[],
    config?: Partial<EmbeddingConfig>,
  ): Promise<EmbeddingResult[]> {
    try {
      if (config) {
        await localAiManager.ensureEmbeddingModel(config);
      }
      const embeddingId = getFamilyModelId("embedding");
      if (embeddingId) modelManager.touchModel(embeddingId);

      const results = await localAiManager.embedBatch(
        texts,
        config?.pooling,
        config?.normalize,
      );
      return results;
    } catch (error) {
      Logger.error("[LocalGateway] 批量嵌入失败", { error: String(error), count: texts.length });
      throw error;
    }
  }

  /**
   * 对文档列表进行重排序
   */
  public async rerank(
    query: string,
    documents: string[],
    config?: Partial<RerankConfig>,
  ): Promise<RerankResult[]> {
    try {
      if (config) {
        await localAiManager.ensureRerankModel(config);
      }
      modelManager.touchModel("bge-reranker-v2-m3");

      const results = await localAiManager.rerank(query, documents);
      return results;
    } catch (error) {
      Logger.error("[LocalGateway] 重排序失败", { error: String(error), query, documentCount: documents.length });
      throw error;
    }
  }

  /**
   * 预热搜索所需模型（嵌入 + 重排序）。
   * 首次语义搜索若在请求路径上加载权重（2.3GB + 1.8GB）会阻塞数秒，
   * 故在用户打开搜索/输入时提前加载；同时延长两者的空闲保留期，
   * 避免 5 分钟空闲卸载造成的反复冷启动。
   */
  public async warmupSearchModels(): Promise<void> {
    const embeddingId = getFamilyModelId("embedding");
    const rerankerId = getFamilyModelId("reranker");
    if (embeddingId) modelManager.setIdleTimeoutFor(embeddingId, SEARCH_MODEL_KEEPALIVE_MS);
    if (rerankerId) modelManager.setIdleTimeoutFor(rerankerId, SEARCH_MODEL_KEEPALIVE_MS);

    await localAiManager.ensureEmbeddingModel();
    await localAiManager.ensureRerankModel();
  }

  /**
   * 本地 LLM 文本生成
   */
  public async generate(prompt: string, options?: LlmGenerateOptions): Promise<string> {
    try {
      const modelPath = modelManager.getModelPath(DEFAULT_LLM_CONFIG.modelId);
      await localAiManager.ensureLlmModel({ modelPath });
      modelManager.touchModel(DEFAULT_LLM_CONFIG.modelId);
      return await localAiManager.generate(prompt, options);
    } catch (error) {
      Logger.error("[LocalGateway] 本地 LLM 生成失败", { error: String(error) });
      throw error;
    }
  }

  /**
   * 本地 LLM 流式文本生成
   */
  public async generateStream(
    prompt: string,
    options?: LlmGenerateOptions,
    onToken?: (token: string) => void,
  ): Promise<string> {
    try {
      const modelPath = modelManager.getModelPath(DEFAULT_LLM_CONFIG.modelId);
      await localAiManager.ensureLlmModel({ modelPath });
      modelManager.touchModel(DEFAULT_LLM_CONFIG.modelId);
      return await localAiManager.generateStream(prompt, options, onToken);
    } catch (error) {
      Logger.error("[LocalGateway] 本地 LLM 流式生成失败", { error: String(error) });
      throw error;
    }
  }
}

export default LocalGateway;
export const localGateway = new LocalGateway();