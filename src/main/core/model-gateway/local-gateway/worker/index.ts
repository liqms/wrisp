/**
 * Local AI Worker 线程入口
 * 在独立线程中执行模型推理，消息路由到各 handler
 */
import * as embeddingHandler from "./embedding-handler";
import * as rerankHandler from "./rerank-handler";
import * as llmHandler from "./llm-handler";
import { Logger } from "@/main/utils/logger";

interface WorkerMessage {
  id: string;
  type: string;
  payload?: unknown;
}

interface WorkerResponse {
  id: string;
  type: string;
  payload?: unknown;
  error?: string;
}

// 消息路由表
const handlers: Record<string, (payload?: unknown) => Promise<unknown>> = {
  "load-embedding": (payload) => embeddingHandler.load(payload as { modelName?: string }),
  "embed": (payload) => {
    const { text, pooling, normalize } = payload as { text: string; pooling?: "mean" | "cls" | "none"; normalize?: boolean };
    return embeddingHandler.embed(text, pooling, normalize);
  },
  "embed-batch": (payload) => {
    const { texts, pooling, normalize } = payload as { texts: string[]; pooling?: "mean" | "cls" | "none"; normalize?: boolean };
    return embeddingHandler.embedBatch(texts, pooling, normalize);
  },
  "unload-embedding": () => embeddingHandler.unload(),

  "load-rerank": (payload) => rerankHandler.load(payload as { modelName?: string }),
  "rerank": (payload) => {
    const { query, documents } = payload as { query: string; documents: string[] };
    return rerankHandler.rerank(query, documents);
  },
  "unload-rerank": () => rerankHandler.unload(),

  "load-llm": (payload) => llmHandler.load(payload as { modelName?: string }),
  "generate": (payload) => {
    const { prompt, options } = payload as { prompt: string; options?: unknown };
    return llmHandler.generate(prompt, options);
  },
  "unload-llm": () => llmHandler.unload(),
};

// 响应类型映射
const responseTypeMap: Record<string, string> = {
  "load-embedding": "embedding-loaded",
  "embed": "embedding-result",
  "embed-batch": "embedding-result",
  "unload-embedding": "embedding-unloaded",
  "load-rerank": "rerank-loaded",
  "rerank": "rerank-result",
  "unload-rerank": "rerank-unloaded",
  "load-llm": "llm-loaded",
  "generate": "llm-result",
  "unload-llm": "llm-unloaded",
};

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { id, type, payload } = event.data;

  try {
    const handler = handlers[type];
    if (!handler) {
      throw new Error(`未知消息类型: ${type}`);
    }

    const result = await handler(payload);
    const responseType = responseTypeMap[type] || type;

    self.postMessage({ id, type: responseType, payload: result } satisfies WorkerResponse);
  } catch (error) {
    Logger.error("[Worker] 处理消息失败", { type, error: String(error) });
    self.postMessage({ id, type: "error", error: String(error) } satisfies WorkerResponse);
  }
};