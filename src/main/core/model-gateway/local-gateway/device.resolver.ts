/**
 * 本地 LLM 的 GPU 使用决策
 *
 * 纯函数：只做「用户开关 + 显存探测结果 + 模型显存需求 → 推理参数」的换算，不含任何 IO，
 * 因此在无 GPU 的 CI/开发机上也能把全部分支测干净。
 *
 * 只作用于 LLM（node-llama-cpp）：嵌入/重排序仍固定走 CPU —— 它们依赖 transformers.js 的
 * GPU EP，而 fp16 权重在 GPU EP 上的可用性尚未验证，混进同一开关会让失败面不可控。
 */
import type { GpuDecisionReason } from "@/shared/types/model.types";

export type { GpuDecisionReason };
/** worker 侧显存探测结果（来自 node-llama-cpp 的 getVramState / getGpuDeviceNames） */
export interface GpuProbeResult {
  /** false = 探测未成功或读数不可信；按「未知」处理，与「确认无 GPU」区分开 */
  measured: boolean;
  /** GPU 设备名；measured 为 false 时为空数组 */
  deviceNames: string[];
  totalVramGB: number;
  freeVramGB: number;
}

/** 探测失败时的统一返回形态 */
export const UNMEASURED_GPU: GpuProbeResult = {
  measured: false,
  deviceNames: [],
  totalVramGB: 0,
  freeVramGB: 0,
};

/**
 * 显存预留量（GB）。
 * Electron 自身的 GPU 合成进程、桌面环境与其他应用共用同一块显存，
 * 按 free 全额判定会在混合显卡机上「理论够、实际分配失败」，故与内存侧 MEMORY_RESERVE_GB 同构留余量。
 */
export const VRAM_RESERVE_GB = 0.8;

/** 给 node-llama-cpp 的两级 GPU 参数 */
export interface LlmGpuPolicy {
  /**
   * `getLlama({ gpu })`：false = 不加载 GPU 构建（连原生 GPU 后端都不初始化）；
   * "auto" = 由 llama.cpp 自行选择后端。
   */
  initGpu: false | "auto";
  /**
   * `loadModel({ gpuLayers })`：0 = 权重不上显存；"auto" = 按模型与显存量自动分配。
   * 与 initGpu 分开是因为：`getLlama` 每次调用都会重新解析/拉取原生二进制，代价高，
   * 所以显存不足时只关这一个开关，不重建 llama 实例。
   */
  gpuLayers: 0 | "auto";
  reason: GpuDecisionReason;
  /** 本次判定使用的显存需求（含预留），便于日志复盘 */
  requiredVramGB: number;
}

export interface LlmGpuPolicyInput {
  /** 用户开关 enableGpuAcceleration */
  enabled: boolean;
  /** 显存探测结果；null = 尚未探测（开关关闭时不该探测） */
  probe: GpuProbeResult | null;
  /** 模型默认变体的 minVRAMGB */
  requiredVramGB: number;
  reserveVramGB?: number;
}

/** 完全不用 GPU 的判定结果 */
function cpuOnly(reason: GpuDecisionReason, requiredVramGB: number): LlmGpuPolicy {
  return { initGpu: false, gpuLayers: 0, reason, requiredVramGB };
}

/** GPU 构建已就绪且不重建（复用实例），但权重不上显存 */
function gpuBuildCpuInference(reason: GpuDecisionReason, requiredVramGB: number): LlmGpuPolicy {
  return { initGpu: "auto", gpuLayers: 0, reason, requiredVramGB };
}

/**
 * 判定本地 LLM 是否使用 GPU。
 *
 * 四条原则：
 * 1. 开关关闭 → 完全不碰 GPU，连探测都不做（零额外初始化成本）；
 * 2. 信息不足（未探测 / GPU 构建初始化失败）→ 保守走 CPU，「不确定」不等于「可以试」；
 * 3. 显存不足 → 降级为 CPU 推理而非拒绝服务，用户拿到的是「慢但可用」；
 * 4. 已付出的初始化成本不回退——探测成功即复用该实例，降级只改 gpuLayers，避免二次 getLlama。
 */
export function resolveLlmGpuPolicy(input: LlmGpuPolicyInput): LlmGpuPolicy {
  const reserveVramGB = input.reserveVramGB ?? VRAM_RESERVE_GB;
  const requiredVramGB = input.requiredVramGB + reserveVramGB;

  if (!input.enabled) return cpuOnly("disabled", requiredVramGB);

  // 开关开了但没有探测结果：不猜测
  if (!input.probe) return cpuOnly("unknown", requiredVramGB);

  // measured=false 意味着 worker 连 GPU 构建都没起来，重建只会再失败一次
  if (!input.probe.measured) return cpuOnly("unknown", requiredVramGB);

  // 以下分支 GPU 构建已就绪：保留实例，只决定是否让权重上显存
  if (input.probe.deviceNames.length === 0) {
    return gpuBuildCpuInference("no-gpu", requiredVramGB);
  }

  if (input.probe.freeVramGB < requiredVramGB) {
    return gpuBuildCpuInference("insufficient-vram", requiredVramGB);
  }

  return {
    initGpu: "auto",
    gpuLayers: "auto",
    reason: "enabled",
    requiredVramGB,
  };
}

/**
 * 推理线程预算的上下限。
 * 下限 1：单核也要能跑；上限 6：再多则边际收益极低而发热陡增（ORT/llama.cpp 的经验拐点）。
 */
export const THREAD_BUDGET_MIN = 1;
export const THREAD_BUDGET_MAX = 6;

/**
 * 典型同层并行的 CPU-bound 会话数：一层内最多同时有「交叉编码器 + LLM」两个推理会话在跑
 * （embedding 与 reranker 分处两个 Worker 线程，但很少与 LLM 三者同时满载）。
 * 实际值由调用方按当轮形态传入，这里只是缺省。
 */
export const DEFAULT_CO_RESIDENT_SESSIONS = 2;

/** resolveThreadBudget 入参 */
export interface ThreadBudgetInput {
  /** 逻辑核心数（含超线程） */
  logicalCores: number;
  /** 用户配置的线程数；null = 按公式分摊 */
  configured: number | null;
  /** 同批争抢 CPU 的推理会话数 */
  coResidentSessions?: number;
}

/**
 * 计算一个推理会话可用的线程数（ONNX `intraOpNumThreads` 与 llama.cpp `maxThreads` 共用）。
 *
 * 纯函数：核心数由调用方读取后传入，便于在无稳定核数的 CI 上穷举分支。
 * 配置值优先且**不被上限夹住**（用户显式要求更多线程时不应静默削减），
 * 只有公式值才夹到 [1, 6]。
 */
export function resolveThreadBudget(input: ThreadBudgetInput): number {
  if (input.configured !== null && Number.isFinite(input.configured)) {
    const configured = Math.floor(input.configured);
    if (configured >= THREAD_BUDGET_MIN) return configured;
  }

  const sessions = Math.max(1, Math.floor(input.coResidentSessions ?? DEFAULT_CO_RESIDENT_SESSIONS));
  const share = Math.floor(Math.max(0, input.logicalCores) / sessions);
  return Math.min(Math.max(share, THREAD_BUDGET_MIN), THREAD_BUDGET_MAX);
}
