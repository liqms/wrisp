// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  CPU_BOUND_MODEL_FAMILIES,
  countCpuBoundFamilies,
} from "@/main/core/smart-tasks/task-dag";

describe("countCpuBoundFamilies 层内 CPU 争抢计数", () => {
  it("reranker 恒为 CPU-bound", () => {
    expect(countCpuBoundFamilies(["reranker"], true)).toBe(1);
    expect(countCpuBoundFamilies(["reranker"], false)).toBe(1);
  });

  it("LLM 只在实际走 CPU 时计入（判据取本轮下发的 gpuLayers，而非配置值）", () => {
    expect(countCpuBoundFamilies(["llm"], true)).toBe(1);
    expect(countCpuBoundFamilies(["llm"], false)).toBe(0);
  });

  it("embedding 不计入：它只在 chunk-vectorize 一层独跑", () => {
    expect(CPU_BOUND_MODEL_FAMILIES).not.toContain("embedding");
    expect(countCpuBoundFamilies(["embedding"], true)).toBe(0);
  });

  it("reranker + 走 CPU 的 LLM 同层时计 2，正是需要串行化的形态", () => {
    expect(countCpuBoundFamilies(["reranker", "llm"], true)).toBe(2);
    expect(countCpuBoundFamilies(["reranker", "llm"], false)).toBe(1);
  });

  it("无模型任务（family 不在表内）不影响计数", () => {
    expect(countCpuBoundFamilies(["embedding", "reranker"], true)).toBe(1);
  });
});
