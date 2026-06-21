/**
 * 重排序模块
 * 通过 LocalGateway 执行推理，避免阻塞主进程
 */
import { localGateway } from "./gateway";
import { RerankResult, RerankConfig } from "./types";
import { Logger } from "@/main/utils/logger";

/**
 * 对文档列表进行重排序
 */
export async function rerank(
  query: string,
  documents: string[],
  config?: Partial<RerankConfig>,
): Promise<RerankResult[]> {
  try {
    return await localGateway.rerank(query, documents, config);
  } catch (error) {
    Logger.error("[Rerank] 重排序失败", { error: String(error), query, documentCount: documents.length });
    throw error;
  }
}
