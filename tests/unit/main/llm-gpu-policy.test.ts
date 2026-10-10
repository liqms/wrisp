// @vitest-environment node
import { describe, it, expect } from "vitest";

import {
  resolveLlmGpuPolicy,
  UNMEASURED_GPU,
  VRAM_RESERVE_GB,
  type GpuProbeResult,
} from "@/main/core/model-gateway/local-gateway/device.resolver";
import { getFamilyMinVramGB } from "@/main/core/model-gateway/local-gateway/model-registry";

/** 构造一份「测到了独显、显存充足」的基准探测结果 */
function probe(overrides: Partial<GpuProbeResult> = {}): GpuProbeResult {
  return {
    measured: true,
    deviceNames: ["NVIDIA GeForce RTX 4060"],
    totalVramGB: 8,
    freeVramGB: 6,
    ...overrides,
  };
}

describe("resolveLlmGpuPolicy", () => {
  it("开关关闭 → disabled，且不加载 GPU 构建", () => {
    const policy = resolveLlmGpuPolicy({
      enabled: false,
      // 即使已有探测结果，开关关闭也不该走 GPU
      probe: probe(),
      requiredVramGB: 4,
    });
    expect(policy.reason).toBe("disabled");
    expect(policy.initGpu).toBe(false);
    expect(policy.gpuLayers).toBe(0);
  });

  it("开关开启但未探测 → unknown，保守走 CPU", () => {
    const policy = resolveLlmGpuPolicy({
      enabled: true,
      probe: null,
      requiredVramGB: 4,
    });
    expect(policy.reason).toBe("unknown");
    expect(policy.initGpu).toBe(false);
    expect(policy.gpuLayers).toBe(0);
  });

  it("探测失败（measured=false）→ unknown，与「确认无 GPU」区分开", () => {
    const policy = resolveLlmGpuPolicy({
      enabled: true,
      probe: UNMEASURED_GPU,
      requiredVramGB: 4,
    });
    expect(policy.reason).toBe("unknown");
    expect(policy.initGpu).toBe(false);
  });

  it("GPU 构建可用但无设备 → no-gpu，保留实例只关掉 gpuLayers", () => {
    const policy = resolveLlmGpuPolicy({
      enabled: true,
      probe: probe({ deviceNames: [] }),
      requiredVramGB: 4,
    });
    expect(policy.reason).toBe("no-gpu");
    // 探测已经付出的 getLlama 成本不回退：实例复用，仅权重不上显存
    expect(policy.initGpu).toBe("auto");
    expect(policy.gpuLayers).toBe(0);
  });

  it("空闲显存低于需求 + 预留 → insufficient-vram，降级而非拒绝服务", () => {
    const policy = resolveLlmGpuPolicy({
      enabled: true,
      probe: probe({ freeVramGB: 4.7 }),
      requiredVramGB: 4,
    });
    expect(policy.reason).toBe("insufficient-vram");
    expect(policy.initGpu).toBe("auto");
    expect(policy.gpuLayers).toBe(0);
  });

  it("显存刚好等于需求 + 预留 → 放行", () => {
    const policy = resolveLlmGpuPolicy({
      enabled: true,
      probe: probe({ freeVramGB: 4 + VRAM_RESERVE_GB }),
      requiredVramGB: 4,
    });
    expect(policy.reason).toBe("enabled");
    expect(policy.initGpu).toBe("auto");
    expect(policy.gpuLayers).toBe("auto");
  });

  it("显存充足 → enabled，两级参数同时打开", () => {
    const policy = resolveLlmGpuPolicy({
      enabled: true,
      probe: probe(),
      requiredVramGB: 4,
    });
    expect(policy.reason).toBe("enabled");
    expect(policy.initGpu).toBe("auto");
    expect(policy.gpuLayers).toBe("auto");
  });

  it("requiredVramGB 含预留量，便于日志复盘", () => {
    const policy = resolveLlmGpuPolicy({
      enabled: true,
      probe: probe(),
      requiredVramGB: 4,
    });
    expect(policy.requiredVramGB).toBeCloseTo(4 + VRAM_RESERVE_GB, 5);
  });

  it("可覆盖预留量", () => {
    const policy = resolveLlmGpuPolicy({
      enabled: true,
      probe: probe({ freeVramGB: 4.5 }),
      requiredVramGB: 4,
      reserveVramGB: 0.5,
    });
    expect(policy.reason).toBe("enabled");
  });
});

describe("闸门显存需求来源", () => {
  it("llm 取默认变体的 minVRAMGB", () => {
    expect(getFamilyMinVramGB("llm")).toBeGreaterThan(0);
  });

  it("embedding / reranker 也有显存参考值（当前仅 LLM 使用闸门）", () => {
    expect(getFamilyMinVramGB("embedding")).toBeGreaterThan(0);
    expect(getFamilyMinVramGB("reranker")).toBeGreaterThan(0);
  });
});
