// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/core/model-gateway/local-gateway/model-manager", () => ({
  modelManager: {
    getModelsBasePath: vi.fn(() => "/mock/models"),
    getModelStatus: vi.fn(),
  },
  default: {},
}));

import { localAiManager } from "@/main/core/model-gateway/local-gateway/manager";

describe("LocalAiManager.getLlmConcurrency", () => {
  it("返回配置的并发度", () => {
    localAiManager.configure({ llm: { concurrency: 4 } });
    expect(localAiManager.getLlmConcurrency()).toBe(4);
  });

  it("默认并发度为 2", () => {
    localAiManager.configure({ llm: { concurrency: 2 } });
    expect(localAiManager.getLlmConcurrency()).toBe(2);
  });

  it("并发度至少为 1", () => {
    localAiManager.configure({ llm: { concurrency: 0 } });
    expect(localAiManager.getLlmConcurrency()).toBe(1);
  });
});