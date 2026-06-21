/**
 * Local Gateway — 本地模型核心模块
 * 提供向量嵌入、重排序和模型管理能力
 */
export { default as LocalAiManager } from "./manager";
export { localAiManager } from "./manager";
export { default as LocalGateway } from "./gateway";
export { localGateway } from "./gateway";
export { default as ModelManager } from "./model-manager";
export { modelManager } from "./model-manager";
export * from "./types";
export * from "./model-registry";
export * from "./hardware";

// 代理方法 — 委托给 localGateway 实例
import { localGateway } from "./gateway";
import type { EmbeddingConfig, RerankConfig } from "./types";

export const embed = (text: string, config?: Partial<EmbeddingConfig>) => localGateway.embed(text, config);
export const embedBatch = (texts: string[], config?: Partial<EmbeddingConfig>) => localGateway.embedBatch(texts, config);
export const rerank = (query: string, documents: string[], config?: Partial<RerankConfig>) => localGateway.rerank(query, documents, config);