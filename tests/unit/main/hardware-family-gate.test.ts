// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const freeMemMock = vi.fn();

vi.mock("os", () => ({
  default: { freemem: () => freeMemMock() },
}));
vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  canLoadModelFamilies,
  canLoadModel,
} from "@/main/core/model-gateway/local-gateway/hardware";

const GB = 1024 ** 3;

describe("canLoadModelFamilies", () => {
  beforeEach(() => freeMemMock.mockReset());

  it("空集合恒为 true", () => {
    freeMemMock.mockReturnValue(0);
    expect(canLoadModelFamilies([])).toBe(true);
  });

  it("三 family 求和 9GB：可用 10GB 通过", () => {
    freeMemMock.mockReturnValue(10 * GB);
    expect(canLoadModelFamilies(["embedding", "reranker", "llm"])).toBe(true);
  });

  it("三 family 求和 9GB：可用 8GB 不通过", () => {
    freeMemMock.mockReturnValue(8 * GB);
    expect(canLoadModelFamilies(["embedding", "reranker", "llm"])).toBe(false);
  });

  it("单 family 与 canLoadModel 口径一致", () => {
    freeMemMock.mockReturnValue(5 * GB);
    expect(canLoadModelFamilies(["llm"])).toBe(canLoadModel(5));
  });
});