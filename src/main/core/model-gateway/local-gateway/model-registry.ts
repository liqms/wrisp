/**
 * 模型元数据注册表
 * 以结构化数据定义所有支持的模型，支持国内外镜像下载地址
 */
import { ZH_REMOTE_HOST, EN_REMOTE_HOST } from "@/main/constants/model.constants";
import type { LocalModelFamily, ModelManifestEntry } from "@/shared/types/model.types";
import type { TransformersDtype } from "./types";

/** 模型类型（字面量定义在 shared，主进程沿用既有别名，避免两处漂移） */
export type ModelFamily = LocalModelFamily;

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
  /** 输出向量维度（仅 embedding 模型有意义） */
  dimension?: number;
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
    modelId: "bge-m3",
    name: "BGE-M3",
    family: "embedding",
    backend: "transformers.js",
    description: "多语言通用文本嵌入模型，输出 1024 维向量",
    defaultVariant: "fp16",
    dimension: 1024,
    variants: [
      {
        variantId: "fp16",
        precision: "FP16",
        requiredFiles: [
          { remotePath: "Xenova/bge-m3/resolve/main/onnx/model_fp16.onnx", localPath: "onnx/model_fp16.onnx" },
          { remotePath: "Xenova/bge-m3/resolve/main/tokenizer.json", localPath: "tokenizer.json" },
          { remotePath: "Xenova/bge-m3/resolve/main/tokenizer_config.json", localPath: "tokenizer_config.json" },
          { remotePath: "Xenova/bge-m3/resolve/main/config.json", localPath: "config.json" },
          { remotePath: "Xenova/bge-m3/resolve/main/special_tokens_map.json", localPath: "special_tokens_map.json" },
        ],
        minMemoryGB: 2,
        minVRAMGB: 1,
        sizeGB: 1.13,
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
  {
    modelId: "qwen3.5-4b",
    name: "Qwen3.5 4B",
    family: "llm",
    backend: "node-llama-cpp",
    description: "4B 级本地生成模型，Unsloth Dynamic Q4_K_XL 量化，约 2.9GB",
    defaultVariant: "ud_q4_k_xl",
    variants: [
      {
        variantId: "ud_q4_k_xl",
        precision: "UD-Q4_K_XL",
        requiredFiles: [
          {
            remotePath: "unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-UD-Q4_K_XL.gguf",
            localPath: "Qwen3.5-4B-UD-Q4_K_XL.gguf",
          },
        ],
        minMemoryGB: 5,
        minVRAMGB: 4,
        sizeGB: 2.9,
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

/**
 * 导出内置模型清单（默认变体的文件集与体积）供渲染进程聚合下载状态。
 * 渲染端不再手抄模型清单：清单一旦与注册表漂移，状态显示就会与磁盘实况脱节。
 */
export function getModelManifest(): ModelManifestEntry[] {
  return BUILTIN_MODELS.map((spec) => {
    const variant = spec.variants.find((v) => v.variantId === spec.defaultVariant);
    return {
      modelId: spec.modelId,
      family: spec.family,
      sizeGB: variant?.sizeGB ?? 0,
      files: (variant?.requiredFiles ?? []).map((f) => ({
        remotePath: f.remotePath,
        localPath: f.localPath,
      })),
    };
  });
}

/**
 * 获取某个 family 当前使用的默认模型 ID（family→modelId 的唯一映射来源，
 * 供按 family 加载/卸载时集中引用，避免魔数散落）。
 */
export function getFamilyModelId(family: ModelFamily): string | undefined {
  return BUILTIN_MODELS.find((m) => m.family === family)?.modelId;
}

/**
 * 获取某 family 默认变体的最低内存要求（GB）。
 * 用于加载前的可用内存校验：未注册或缺少默认变体时返回 0。
 */
export function getFamilyMinMemoryGB(family: ModelFamily): number {
  const modelId = getFamilyModelId(family);
  if (!modelId) return 0;
  const spec = getModelSpec(modelId);
  if (!spec) return 0;
  return spec.variants.find((v) => v.variantId === spec.defaultVariant)?.minMemoryGB ?? 0;
}

/**
 * 获取某 family 默认变体的最低显存要求（GB）。
 * 用于 GPU 加速前的显存校验：未注册或缺少默认变体时返回 0（= 不满足也不阻塞，交由内存闸门兜底）。
 */
export function getFamilyMinVramGB(family: ModelFamily): number {
  const modelId = getFamilyModelId(family);
  if (!modelId) return 0;
  const spec = getModelSpec(modelId);
  if (!spec) return 0;
  return spec.variants.find((v) => v.variantId === spec.defaultVariant)?.minVRAMGB ?? 0;
}

/** transformers.js 单会话模型的权重基名（拼接规则：`<基名><dtype 后缀>.onnx`） */
const SESSION_FILE_STEM = "model";

/**
 * dtype → ONNX 文件名后缀，与库内 `DEFAULT_DTYPE_SUFFIX_MAPPING` 对齐。
 * fp32 后缀为空串，故不出现在此表：它对应「基名即完整文件名」那一支。
 */
const DTYPE_SUFFIX: Record<Exclude<TransformersDtype, "fp32">, string> = {
  fp16: "_fp16",
  int8: "_int8",
  uint8: "_uint8",
  q8: "_quantized",
};

/**
 * 从已下载的 ONNX 文件名反解 dtype。
 * 只认 `<基名>` 与 `<基名><已知后缀>` 两种形态，其余（含 `_bnb4` 等未收录精度、
 * 以及误拼出的 `_fp16_fp16`）一律返回 null，交由调用方中止加载。
 */
export function parseTransformersDtype(fileName: string): TransformersDtype | null {
  if (!fileName.endsWith(".onnx")) return null;
  const base = fileName.slice(0, -".onnx".length);
  if (base === SESSION_FILE_STEM) return "fp32";
  for (const [dtype, suffix] of Object.entries(DTYPE_SUFFIX)) {
    if (base === SESSION_FILE_STEM + suffix) return dtype as TransformersDtype;
  }
  return null;
}

/**
 * 解析 transformers.js 定位本地模型文件所需的信息。
 * 下载产物布局为 `<模型根目录>/<modelId>/<localPath>`（见 model.service 下载逻辑），
 * 与 transformers.js 的 `localModelPath + 模型目录 + onnx/model<dtype后缀>.onnx` 解析规则对齐，
 * 使 worker 直接从下载目录读取（而非回退到远程或模块内缓存）。
 */
export function getTransformersArtifacts(
  modelId: string,
): { modelDir: string; dtype: TransformersDtype } | null {
  const spec = getModelSpec(modelId);
  if (!spec) return null;
  const variant = spec.variants.find((v) => v.variantId === spec.defaultVariant);
  if (!variant) return null;
  const onnxFile = variant.requiredFiles.find(
    (f) => f.localPath.startsWith("onnx/") && f.localPath.endsWith(".onnx"),
  );
  if (!onnxFile) return null;
  // 推导失败时宁可返回 null（调用方报错并跳过加载），也不要猜一个精度去加载错的权重
  const dtype = parseTransformersDtype(onnxFile.localPath.slice("onnx/".length));
  if (!dtype) return null;
  return { modelDir: modelId, dtype };
}

/**
 * 当前嵌入模型的输出维度。
 * 向量库表结构与检索向量长度均以此为准，避免"换了模型、表维度没跟着换"的漂移。
 */
export const EMBEDDING_DIMENSION =
  BUILTIN_MODELS.find((m) => m.family === "embedding")?.dimension ?? 1024;