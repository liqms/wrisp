// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { mapWithConcurrency } from "@/main/core/smart-tasks/concurrency";

describe("mapWithConcurrency", () => {
  it("并发不超过 limit 且确实并行", async () => {
    let active = 0;
    let maxObserved = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      active++;
      maxObserved = Math.max(maxObserved, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
    });
    expect(maxObserved).toBeLessThanOrEqual(2);
    expect(maxObserved).toBeGreaterThan(1);
  });

  it("结果保持输入顺序", async () => {
    const result = await mapWithConcurrency([3, 1, 2], 3, async (n) => {
      await new Promise((r) => setTimeout(r, n * 5));
      return n * 10;
    });
    expect(result).toEqual([30, 10, 20]);
  });

  it("取消后不再启动新项", async () => {
    const signal = { cancelled: false };
    const fn = vi.fn(async () => {
      signal.cancelled = true;
      await new Promise((r) => setTimeout(r, 5));
    });
    await mapWithConcurrency([1, 2, 3, 4], 1, fn, signal);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("limit 超过条目数时全部执行", async () => {
    const fn = vi.fn(async (n: number) => n);
    const result = await mapWithConcurrency([1, 2], 10, fn);
    expect(result).toEqual([1, 2]);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("limit < 1 时夹紧为 1", async () => {
    let active = 0;
    let maxObserved = 0;
    await mapWithConcurrency([1, 2, 3], 0, async () => {
      active++;
      maxObserved = Math.max(maxObserved, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    });
    expect(maxObserved).toBe(1);
  });
});