/**
 * 本地 AI 核心类型定义
 */

/** 模型状态 */
export type ModelStatus = "unloaded" | "loading" | "loaded" | "error";

/** 池化方法 */
export type PoolingMethod = "mean" | "cls";

/**
 * transformers.js 的权重精度标识。
 * 只列出本仓下载文件名后缀可反解出的取值（见 model-registry 的 dtype 反查表）。
 */
export type TransformersDtype = "fp32" | "fp16" | "int8" | "uint8" | "q8";

/** 嵌入模型配置 */
export interface EmbeddingConfig {
  /** 模型名称，默认 bge-small-en-v1.5 */
  modelName?: string;
  /** 池化方法，默认 mean */
  pooling?: PoolingMethod;
  /** 是否归一化向量，默认 true */
  normalize?: boolean;
}

/** 重排序模型配置 */
export interface RerankConfig {
  /** 模型名称，默认 ms-marco-MiniLM-L-6-v2 */
  modelName?: string;
}

/**
 * transformers.js 本地模型文件定位信息。
 * 与下载产物布局（`<modelRoot>/<modelDir>/onnx/model<dtypeSuffix>.onnx`）对应，
 * 由 model-manager 注入，使 worker 从本地下载目录读取模型。
 */
export interface TransformersModelPaths {
  /** 本地模型根目录（绝对路径），对应 transformers.js 的 env.localModelPath */
  modelRoot: string;
  /** 相对 modelRoot 的模型目录，形如 `<modelId>`（与下载布局一致，不含变体层级） */
  modelDir: string;
  /**
   * 权重精度，对应 transformers.js 的 dtype 选项（库自行拼接 `onnx/model<suffix>.onnx`）。
   * 不能再传文件名：文件名与 dtype 同时给会拼成 `model_fp16_fp16.onnx`。
   */
  dtype: TransformersDtype;
}

/** 本地 LLM 配置 */
export interface LlmConfig {
  /** 模型 ID */
  modelId: string;
  /** 模型文件绝对路径 */
  modelPath: string;
  /** 上下文长度，默认 4096 */
  contextSize: number;
  /** 单次生成最大 token 数，默认 1024 */
  maxTokens: number;
  /** 采样温度，默认 0.7 */
  temperature: number;
  /** 是否允许加载 GPU 构建（auto）或完全不碰 GPU（cpu），默认 cpu */
  gpu: "auto" | "cpu";
  /**
   * 权重是否上显存，由主进程按显存闸门判定后下发（0 = 强制 CPU 推理）。
   * 与 gpu 分开：GPU 构建已初始化时降级只需改这里，不必重建 llama 实例。
   */
  gpuLayers?: 0 | "auto";
  /** 并发数（= context 池大小），默认 2；每个并发占一份 KV cache 内存 */
  concurrency?: number;
  /**
   * llama 实例的线程上限（`getLlama({ maxThreads })`）。
   * 取实例级而非 context 级：context 的 `threads` 只是 hint（其它评估在跑时会更低），
   * 且并发 context 共享同一实例与 ThreadsSplitter，实例上限才是散热的权威闸门。
   * 未下发时 node-llama-cpp 在 CPU 形态下默认吃满 `max(cpuMathCores, 4)`。
   */
  maxThreads?: number;
}

/** 生成参数 */
export interface LlmGenerateOptions {
  maxTokens?: number;
  temperature?: number;
}

/** 重排序结果 */
export interface RerankResult {
  /** 文档原始索引 */
  index: number;
  /** 相关性分数（0~1） */
  score: number;
}

/** 嵌入结果 */
export interface EmbeddingResult {
  /** 嵌入向量 */
  vector: number[];
  /** 向量维度 */
  dimension: number;
}

/** 模型状态信息 */
export interface ModelState {
  status: ModelStatus;
  modelName: string;
  error?: string;
}

/** 本地 AI 总配置 */
export interface LocalAiConfig {
  embedding?: EmbeddingConfig;
  rerank?: RerankConfig;
  llm?: Partial<LlmConfig>;

  /** 模型缓存目录，默认使用 Transformers.js 默认缓存 */
  cacheDir?: string;
}

/** 默认嵌入模型配置 */
export const DEFAULT_EMBEDDING_CONFIG: Required<EmbeddingConfig> = {
  modelName: "Xenova/bge-m3",
  pooling: "cls",
  normalize: true,
};

/** 默认重排序模型配置 */
export const DEFAULT_RERANK_CONFIG: Required<RerankConfig> = {
  modelName: "Xenova/bge-reranker-v2-m3",
};

/** 默认本地 LLM 配置（modelPath 需运行时注入） */
export const DEFAULT_LLM_CONFIG: Omit<LlmConfig, "modelPath"> = {
  modelId: "qwen3.5-4b",
  contextSize: 4096,
  maxTokens: 1024,
  temperature: 0.7,
  /**
   * 默认 cpu：GPU 由 enableGpuAcceleration 开关 + 显存闸门在加载时显式下发，
   * 缺省值必须是「不会意外启用 GPU」的那一个。
   */
  gpu: "cpu",
  concurrency: 2,
};
