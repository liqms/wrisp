/**
 * 硬件检测模块
 * 检测系统硬件信息，用于推荐合适的模型精度变体
 */
import os from "os";
import { Logger } from "@/main/utils/logger";

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