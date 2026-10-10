import { OutputModelType, Locale, TaskType } from "@/shared/enums";

export type ModelType = "base" | "core";

/** 本地模型类别（字面量唯一来源，主进程 model-registry 以 ModelFamily 别名复用） */
export type LocalModelFamily = "embedding" | "reranker" | "llm";

export interface ModelManifestFile {
  remotePath: string;
  localPath: string;
}

/**
 * 主进程 BUILTIN_MODELS 对渲染进程的投影。
 * 渲染端据此按模型聚合下载进度，不再手抄一份模型清单（清单漂移会让状态显示与真实文件脱节）。
 */
export interface ModelManifestEntry {
  modelId: string;
  family: LocalModelFamily;
  /** 注册表声明的整体体积，用作进度分母（单文件 totalBytes 只有该文件开始下载后才可知） */
  sizeGB: number;
  files: ModelManifestFile[];
}

export interface AIProvider {
  id: string;
  name: string;
  models: Model[];
  apiKey?: string;
  logoPath?: string;
  baseUrl: string;
  websiteUrl?: string;
  locale: Locale;
  enabled?: boolean;
}

export interface Model {
  id: string;
  name: string;
  outputType: OutputModelType;
  contextLength: number;
  maxTokens: number;
  isInputText: boolean;
  isInputPic: boolean;
  isInputAudio: boolean;
  isInputVideo: boolean;
  structuredOutputs?: boolean;
}

export interface DefaultModel {
  outputType: OutputModelType;
  providerId: string;
  modelId: string;
  /** 关联的创作任务类型；设置后仅对该 taskType 生效，不设置则为该 outputType 的通用默认模型 */
  taskType?: TaskType;
}

export interface ModelConfig {
  aiProviders: AIProvider[];
  defaultModels: DefaultModel[];
  providerPriority: string[];
  enableAiMode?: boolean; // 是否启用本地AI模式
  enableCloudAi?: boolean; // 是否启用云AI
  /**
   * 是否允许本地 LLM 使用 GPU 加速；缺省 = 不启用（全部走 CPU）。
   * 仅作用于 LLM：嵌入与重排序仍固定 CPU。
   */
  enableGpuAcceleration?: boolean;
  /**
   * 指定必须走本地 LLM 的任务类型；缺省 = 云端优先。仅对 LLM 类任务有意义。
   * 可配置范围限定为智能整理的 3 个 LLM 场景（summary / concept_naming / topic_summary）。
   */
  localLlmTasks?: TaskType[];
  version: string; // 配置文件版本
  updatedAt: string; // 更新时间
}

/** GPU 判定结论，同时用于告知 UI「为什么没走 GPU」 */
export type GpuDecisionReason =
  | "disabled"
  | "unknown"
  | "no-gpu"
  | "insufficient-vram"
  | "enabled";

/**
 * 本地 LLM 的 GPU 能力快照（供设置页展示）。
 * 未探测过时 probed=false，此时 deviceNames/显存字段均为空值，UI 应显示「尚未检测」而非「无 GPU」。
 */
export interface GpuCapability {
  /** 用户开关状态 */
  enabled: boolean;
  /** 是否已探测（探测只在开关打开后进行） */
  probed: boolean;
  /** 探测到的 GPU 设备名 */
  deviceNames: string[];
  /** 显存总量（GB） */
  totalVramGB: number;
  /** 当前空闲显存（GB） */
  freeVramGB: number;
  /** 显存闸门要求的最小显存（含预留，GB） */
  requiredVramGB: number;
  /** 本次判定是否会放行 GPU */
  usable: boolean;
  /** 判定依据，供 UI 组织文案 */
  reason: GpuDecisionReason;
}

/**
 * 推理线程预算的实际生效值（供设置页展示）。
 * 线程数在模型**加载期**读取，改配置后要重载模型才生效，UI 需据此提示。
 */
export interface ThreadBudgetInfo {
  /** 本机逻辑核数 */
  logicalCores: number;
  /** ONNX 会话（embedding / reranker）实际会用的 intraOpNumThreads */
  onnx: number;
  /** 本地 LLM 实际会用的 maxThreads */
  llm: number;
  /** onnx 值是否来自用户配置（false = 按核数与同批会话数分摊） */
  onnxConfigured: boolean;
  /** llm 值是否来自用户配置 */
  llmConfigured: boolean;
}

/**
 * 厂商模型元信息（从远程资源文件 model-meta/provider-models.json 加载）。
 * 用于补充 /models 接口返回不全的字段（contextLength/maxTokens/多模态能力等）。
 * 所有字段可选，未提供时保留适配器返回的原值。
 */
export interface ModelMeta {
  contextLength?: number;
  maxTokens?: number;
  isInputText?: boolean;
  isInputPic?: boolean;
  isInputAudio?: boolean;
  isInputVideo?: boolean;
  structuredOutputs?: boolean;
  outputType?: OutputModelType;
}

/** model-meta/provider-models.json 文件结构 */
export interface ProviderModelsMeta {
  version: string;
  updatedAt: string;
  providers: Record<string, Record<string, ModelMeta>>;
}
