/**
 * 系统资源快照
 * 采集 CPU 使用率与内存占用，用于智能整理"启动/释放模型"节点的概要信息。
 */
import os from "os";

/** 系统资源快照 */
export interface ResourceSnapshot {
  /** CPU 使用率 0-100（首次调用无基准时为 0） */
  cpuUsage: number;
  /** 已用内存（bytes） */
  memoryUsed: number;
  /** 内存总量（bytes） */
  memoryTotal: number;
  /** 内存占用百分比 0-100 */
  memoryPercent: number;
}

interface CpuSample {
  idle: number;
  total: number;
}

let lastCpuSample: CpuSample | null = null;

/** 汇总所有核心的累计 CPU tick */
function readCpuSample(): CpuSample {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    const times = cpu.times;
    idle += times.idle;
    total += times.user + times.nice + times.sys + times.idle + times.irq;
  }
  return { idle, total };
}

/**
 * 获取系统资源快照。
 * CPU 使用率基于两次调用的累计 tick 差值计算；首次调用无历史样本，返回 0。
 */
export function getResourceSnapshot(): ResourceSnapshot {
  const memoryTotal = os.totalmem();
  const memoryFree = os.freemem();
  const memoryUsed = memoryTotal - memoryFree;
  const memoryPercent = memoryTotal > 0 ? Math.round((memoryUsed / memoryTotal) * 100) : 0;

  const current = readCpuSample();
  let cpuUsage = 0;
  if (lastCpuSample) {
    const dIdle = current.idle - lastCpuSample.idle;
    const dTotal = current.total - lastCpuSample.total;
    if (dTotal > 0) {
      cpuUsage = Math.round((1 - dIdle / dTotal) * 100);
      cpuUsage = Math.min(Math.max(cpuUsage, 0), 100);
    }
  }
  lastCpuSample = current;

  return { cpuUsage, memoryUsed, memoryTotal, memoryPercent };
}