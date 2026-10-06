// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const getValueMock = vi.fn();
const checkModelFilesMock = vi.fn();
const canLoadModelMock = vi.fn();

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/core/services/ai/model.service", () => ({
  modelService: { getValue: (...args: unknown[]) => getValueMock(...args) },
  default: {},
}));
vi.mock("@/main/core/model-gateway/local-gateway/model-manager", () => ({
  modelManager: {
    checkModelFiles: (...args: unknown[]) => checkModelFilesMock(...args),
  },
  default: {},
}));
vi.mock("@/main/core/model-gateway/local-gateway/hardware", () => ({
  canLoadModel: (...args: unknown[]) => canLoadModelMock(...args),
}));

import { modelRouter } from "@/main/core/model-gateway/router";
import { TASK_TYPE } from "@/shared/enums";

/** 构造 modelService.getValue 的返回值：默认无云端、无本地、无覆盖 */
function mockConfig(overrides: Record<string, unknown> = {}): void {
  const base: Record<string, unknown> = {
    enableAiMode: false,
    enableCloudAi: false,
    aiProviders: [],
    localLlmTasks: [],
    ...overrides,
  };
  getValueMock.mockImplementation((key: string) => base[key]);
}

const cloudOn = {
  enableCloudAi: true,
  aiProviders: [{ id: "p1", enabled: true }],
};

describe("ModelRouter.route 云端优先 + 按任务类型覆盖", () => {
  beforeEach(() => {
    getValueMock.mockReset();
    checkModelFilesMock.mockReset().mockResolvedValue({ complete: true });
    canLoadModelMock.mockReset().mockReturnValue(true);
  });

  it("AC1：云端可用且未指定本地时走云端，且不检查本地模型文件", async () => {
    mockConfig(cloudOn);
    await expect(modelRouter.route(TASK_TYPE.SUMMARY)).resolves.toBe("cloud");
    expect(checkModelFilesMock).not.toHaveBeenCalled();
  });

  it("AC2：任务被指定走本地且本地可用时走本地", async () => {
    mockConfig({ enableAiMode: true, localLlmTasks: [TASK_TYPE.SUMMARY] });
    await expect(modelRouter.route(TASK_TYPE.SUMMARY)).resolves.toBe("local");
  });

  it("AC2/D4：指定走本地但本地不可用时回退云端", async () => {
    mockConfig({
      ...cloudOn,
      enableAiMode: false,
      localLlmTasks: [TASK_TYPE.SUMMARY],
    });
    await expect(modelRouter.route(TASK_TYPE.SUMMARY)).resolves.toBe("cloud");
  });

  it("AC2/D4：指定走本地、本地与云端都不可用时抛错", async () => {
    mockConfig({ enableAiMode: false, localLlmTasks: [TASK_TYPE.SUMMARY] });
    await expect(modelRouter.route(TASK_TYPE.SUMMARY)).rejects.toThrow();
  });

  it("AC3：localLlmTasks 为空且云端不可用时降级本地（保留离线可用性）", async () => {
    mockConfig({ enableAiMode: true });
    await expect(modelRouter.route(TASK_TYPE.SUMMARY)).resolves.toBe("local");
  });

  it("P6：云端不可用且内存不足时不选本地 LLM", async () => {
    mockConfig({ enableAiMode: true });
    canLoadModelMock.mockReturnValue(false);
    await expect(modelRouter.route(TASK_TYPE.SUMMARY)).rejects.toThrow();
    expect(checkModelFilesMock).not.toHaveBeenCalled();
  });

  it("未知任务类型抛错", async () => {
    mockConfig({});
    await expect(modelRouter.route("nope" as never)).rejects.toThrow(
      "未知任务类型",
    );
  });
});