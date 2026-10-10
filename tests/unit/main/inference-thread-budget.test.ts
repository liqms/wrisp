// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  resolveThreadBudget,
  THREAD_BUDGET_MIN,
  THREAD_BUDGET_MAX,
  DEFAULT_CO_RESIDENT_SESSIONS,
} from "@/main/core/model-gateway/local-gateway/device.resolver";

describe("resolveThreadBudget 推理线程预算", () => {
  it("配置值优先，且不被公式上限夹住", () => {
    expect(resolveThreadBudget({ logicalCores: 18, configured: 8 })).toBe(8);
    expect(resolveThreadBudget({ logicalCores: 18, configured: 1 })).toBe(1);
  });

  it("配置值非法（0 / 负数 / NaN）时回退公式，而不是把会话压成 0 线程", () => {
    expect(resolveThreadBudget({ logicalCores: 12, configured: 0 })).toBe(6);
    expect(resolveThreadBudget({ logicalCores: 12, configured: -3 })).toBe(6);
    expect(resolveThreadBudget({ logicalCores: 12, configured: Number.NaN })).toBe(6);
  });

  it("未配置时按同批会话数分摊逻辑核", () => {
    expect(
      resolveThreadBudget({ logicalCores: 18, configured: null, coResidentSessions: 3 }),
    ).toBe(6);
    // 缺省同批会话数 = 2
    expect(resolveThreadBudget({ logicalCores: 8, configured: null })).toBe(4);
  });

  it("分摊结果夹在上限内：核数再多也不会超过 THREAD_BUDGET_MAX", () => {
    expect(resolveThreadBudget({ logicalCores: 64, configured: null, coResidentSessions: 1 }))
      .toBe(THREAD_BUDGET_MAX);
  });

  it("核数极小时退化到下限 1，绝不返回 0", () => {
    expect(resolveThreadBudget({ logicalCores: 2, configured: null, coResidentSessions: 4 }))
      .toBe(THREAD_BUDGET_MIN);
    expect(resolveThreadBudget({ logicalCores: 0, configured: null })).toBe(THREAD_BUDGET_MIN);
  });

  it("同批会话数非法时按 1 处理，不至于除零", () => {
    expect(resolveThreadBudget({ logicalCores: 6, configured: null, coResidentSessions: 0 }))
      .toBe(THREAD_BUDGET_MAX);
  });

  it("缺省同批会话数为 2（reranker + LLM 的典型同层形态）", () => {
    expect(DEFAULT_CO_RESIDENT_SESSIONS).toBe(2);
  });
});
