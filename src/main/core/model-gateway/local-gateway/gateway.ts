/**
 * Local Gateway — 本地 AI 统一推理入口
 * 封装 Embedding 和 Reranker 的调用，自动管理模型生命周期和空闲卸载
 */
import { localAiManager } from "./manager";
import { modelManager } from "./model-manager";
import { EmbeddingResult, EmbeddingConfig, RerankResult, RerankConfig } from "./types";
import { Logger } from "@/main/utils/logger";

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
      modelManager.touchModel("jina-embeddings-v3");

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
      modelManager.touchModel("jina-embeddings-v3");

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
   * 文本生成（预留，未来 LLM 集成时实现）
   */
  public async generate(_prompt: string, _options?: unknown): Promise<string> {
    throw new Error("本地 LLM 生成功能尚未实现");
  }

  /**
   * 流式文本生成（预留，未来 LLM 集成时实现）
   */
  public async generateStream(
    _prompt: string,
    _options?: unknown,
    _onToken?: (token: string) => void,
  ): Promise<string> {
    throw new Error("本地 LLM 流式生成功能尚未实现");
  }
}

export default LocalGateway;
export const localGateway = new LocalGateway();