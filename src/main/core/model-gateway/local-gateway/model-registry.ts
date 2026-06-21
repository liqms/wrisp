/**
 * 模型元数据注册表
 * 以结构化数据定义所有支持的模型，支持国内外镜像下载地址
 */
import { ZH_REMOTE_HOST, EN_REMOTE_HOST } from "@/main/constants/model.constants";

/** 模型类型 */
export type ModelFamily = "embedding" | "reranker" | "llm";

/** 后端类型 */
export type ModelBackend = "transformers.js" | "node-llama-cpp";

/** 模型文件定义 */
export interface ModelFileSpec {
  remotePath: string;
  localPath: string;
  size?: number;
  checksum?: string;
}

/** 模型变体 */
export interface ModelVariant {
  variantId: string;
  precision: string;
  requiredFiles: ModelFileSpec[];
  minMemoryGB: number;
  minVRAMGB: number;
  sizeGB: number;
}

/** 完整模型定义 */
export interface ModelSpec {
  modelId: string;
  name: string;
  family: ModelFamily;
  backend: ModelBackend;
  description: string;
  defaultVariant: string;
  variants: ModelVariant[];
  fallbackVariantId?: string;
}

/** 镜像类型 */
export type MirrorType = "zh" | "en";

/**
 * 根据镜像类型解析完整下载 URL
 */
export function resolveModelUrl(remotePath: string, mirror: MirrorType = "en"): string {
  const host = mirror === "zh" ? ZH_REMOTE_HOST : EN_REMOTE_HOST;
  return `${host}/${remotePath}`;
}

/** 内置模型清单 */
export const BUILTIN_MODELS: ModelSpec[] = [
  {
    modelId: "jina-embeddings-v3",
    name: "Jina Embeddings v3",
    family: "embedding",
    backend: "transformers.js",
    description: "高性能通用文本嵌入模型，支持多种检索任务，输出 1024 维向量",
    defaultVariant: "fp16",
    variants: [
      {
        variantId: "fp16",
        precision: "FP16",
        requiredFiles: [
          { remotePath: "jinaai/jina-embeddings-v3/resolve/main/onnx/model_fp16.onnx", localPath: "onnx/model_fp16.onnx" },
          { remotePath: "jinaai/jina-embeddings-v3/resolve/main/tokenizer.json", localPath: "tokenizer.json" },
          { remotePath: "jinaai/jina-embeddings-v3/resolve/main/tokenizer_config.json", localPath: "tokenizer_config.json" },
          { remotePath: "jinaai/jina-embeddings-v3/resolve/main/config.json", localPath: "config.json" },
          { remotePath: "jinaai/jina-embeddings-v3/resolve/main/special_tokens_map.json", localPath: "special_tokens_map.json" },
        ],
        minMemoryGB: 2,
        minVRAMGB: 1,
        sizeGB: 2.3,
      },
    ],
  },
  {
    modelId: "bge-reranker-v2-m3",
    name: "BGE Reranker v2 M3",
    family: "reranker",
    backend: "transformers.js",
    description: "多语言交叉编码器重排序模型，用于对候选文档进行精确相关性排序",
    defaultVariant: "fp16",
    variants: [
      {
        variantId: "fp16",
        precision: "FP16",
        requiredFiles: [
          { remotePath: "onnx-community/bge-reranker-v2-m3-ONNX/resolve/main/onnx/model_fp16.onnx", localPath: "onnx/model_fp16.onnx" },
          { remotePath: "onnx-community/bge-reranker-v2-m3-ONNX/resolve/main/tokenizer.json", localPath: "tokenizer.json" },
          { remotePath: "onnx-community/bge-reranker-v2-m3-ONNX/resolve/main/tokenizer_config.json", localPath: "tokenizer_config.json" },
          { remotePath: "onnx-community/bge-reranker-v2-m3-ONNX/resolve/main/config.json", localPath: "config.json" },
          { remotePath: "onnx-community/bge-reranker-v2-m3-ONNX/resolve/main/special_tokens_map.json", localPath: "special_tokens_map.json" },
        ],
        minMemoryGB: 2,
        minVRAMGB: 1,
        sizeGB: 1.8,
      },
    ],
  },
];

/**
 * 根据 modelId 获取模型规格
 */
export function getModelSpec(modelId: string): ModelSpec | undefined {
  return BUILTIN_MODELS.find((m) => m.modelId === modelId);
}

/**
 * 根据模型类型获取模型列表
 */
export function getModelsByFamily(family: ModelFamily): ModelSpec[] {
  return BUILTIN_MODELS.filter((m) => m.family === family);
}