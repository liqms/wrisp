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

/** 对单个文本进行向量嵌入（代理方法） */
export const embed = (text: string, config?: Partial<EmbeddingConfig>) => localGateway.embed(text, config);
/** 对批量文本进行向量嵌入（代理方法） */
export const embedBatch = (texts: string[], config?: Partial<EmbeddingConfig>) => localGateway.embedBatch(texts, config);
/** 对文档列表进行重排序（代理方法） */
export const rerank = (query: string, documents: string[], config?: Partial<RerankConfig>) => localGateway.rerank(query, documents, config);