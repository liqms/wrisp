/**
 * 向量嵌入模块
 * 通过 LocalGateway 执行推理，避免阻塞主进程
 */
import { localGateway } from "./gateway";
import { EmbeddingResult, EmbeddingConfig } from "./types";
import { Logger } from "@/main/utils/logger";

/**
 * 对单个文本进行向量嵌入
 */
export async function embed(text: string, config?: Partial<EmbeddingConfig>): Promise<EmbeddingResult> {
  try {
    return await localGateway.embed(text, config);
  } catch (error) {
    Logger.error("[Embeddings] 嵌入失败", { error: String(error), text });
    throw error;
  }
}

/**
 * 对批量文本进行向量嵌入
 */
export async function embedBatch(
  texts: string[],
  config?: Partial<EmbeddingConfig>,
): Promise<EmbeddingResult[]> {
  try {
    return await localGateway.embedBatch(texts, config);
  } catch (error) {
    Logger.error("[Embeddings] 批量嵌入失败", { error: String(error), count: texts.length });
    throw error;
  }
}
