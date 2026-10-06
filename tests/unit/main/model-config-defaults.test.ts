// @vitest-environment node
import { describe, it, expect } from "vitest";
import { DEFAULT_MODEL_CONFIG } from "@/main/constants/model.constants";

describe("DEFAULT_MODEL_CONFIG", () => {
  it("localLlmTasks 默认为空数组（等价于云端优先）", () => {
    expect(DEFAULT_MODEL_CONFIG.localLlmTasks).toEqual([]);
  });

  it("version 已提升到 0.2.0", () => {
    expect(DEFAULT_MODEL_CONFIG.version).toBe("0.2.0");
  });
});