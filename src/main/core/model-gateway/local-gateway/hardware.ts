/**
 * 硬件检测模块
 * 检测系统硬件信息，用于推荐合适的模型精度变体
 */
import os from "os";
import { Logger } from "@/main/utils/logger";
import { getFamilyMinMemoryGB } from "./model-registry";
import type { ModelFamily } from "./model-registry";

export interface GPUInfo {
  available: boolean;
  name: string;
  totalVRAMGB: number;
  freeVRAMGB: number;
  backend: "cuda" | "metal" | "cpu";
}

export interface HardwareInfo {
  totalMemoryGB: number;
  freeMemoryGB: number;
  gpuInfo: GPUInfo | null;
}

/**
 * 逻辑核心数（含超线程），线程预算分摊的口径。
 * 至少返回 1：核数读不到时也不能算出 0 线程。
 */
export function getLogicalCores(): number {
  return Math.max(1, os.cpus().length);
}

/**
 * 检测系统硬件信息
 * 初期仅检测内存，GPU 检测预留到 LLM 阶段
 */
export async function detectHardware(): Promise<HardwareInfo> {
  const totalMemoryGB = Math.round(os.totalmem() / (1024 * 1024 * 1024) * 10) / 10;
  const freeMemoryGB = Math.round(os.freemem() / (1024 * 1024 * 1024) * 10) / 10;

  Logger.info("[Hardware] 系统内存检测", { totalMemoryGB, freeMemoryGB });

  // GPU 检测暂未实现，返回 null
  const gpuInfo: GPUInfo | null = null;

  return { totalMemoryGB, freeMemoryGB, gpuInfo };
}

/**
 * 根据硬件信息推荐模型变体
 * @param minMemoryGB 模型所需最低内存
 * @returns 是否推荐加载
 */
export function canLoadModel(minMemoryGB: number): boolean {
  const freeMemoryGB = Math.round(os.freemem() / (1024 * 1024 * 1024) * 10) / 10;
  return freeMemoryGB >= minMemoryGB;
}

/**
 * 多个 family 能否同时驻留：按 minMemoryGB 求和与当前可用内存比较（保守口径）。
 * 例：embedding 2 + reranker 2 + llm 5 = 9GB，低于该值则不建议并行驻留、应回退串行。
 * 单模型场景请继续使用 canLoadModel。
 */
export function canLoadModelFamilies(families: ModelFamily[]): boolean {
  if (families.length === 0) return true;
  const requiredGB = families.reduce(
    (sum, family) => sum + getFamilyMinMemoryGB(family),
    0,
  );
  return canLoadModel(requiredGB);
}

/**
 * 每个并发 context 的经验 KV cache 占用（GB）。
 * 保守取 0.5：context 越长实际占用越大，宁可低估并发、避免内存换页。
 */
const KV_CACHE_PER_CONTEXT_GB = 0.5;

/**
 * 模型加载后预留给系统、其他模型与峰值波动的内存余量（GB）。
 */
const MEMORY_RESERVE_GB = 1;

/** recommendLlmConcurrency 入参 */
export interface LlmConcurrencyOptions {
  /** 模型权重占用（GB），用 ModelSpec 默认变体的 sizeGB */
  modelSizeGB: number;
  /** 并发上限（恒为上限，绝不放大） */
  maxConcurrency: number;
  /** 单个并发 context 的 KV cache 经验占用（GB），默认 KV_CACHE_PER_CONTEXT_GB */
  kvCachePerContextGB?: number;
  /** 预留内存余量（GB），默认 MEMORY_RESERVE_GB */
  reserveGB?: number;
}

/**
 * 依据当前可用内存推荐 LLM context 池并发数。
 * 只向下夹紧：结果 ∈ [1, maxConcurrency]，内存越少并发越低，绝不超过上限。
 * 同步、基于 os.freemem()，不引入 detectHardware() 的异步与日志。
 */
export function recommendLlmConcurrency(options: LlmConcurrencyOptions): number {
  const kvCachePerContextGB = options.kvCachePerContextGB ?? KV_CACHE_PER_CONTEXT_GB;
  const reserveGB = options.reserveGB ?? MEMORY_RESERVE_GB;
  const freeMemoryGB = os.freemem() / (1024 * 1024 * 1024);
  const affordable = Math.floor((freeMemoryGB - options.modelSizeGB - reserveGB) / kvCachePerContextGB);
  return Math.min(Math.max(affordable, 1), options.maxConcurrency);
}