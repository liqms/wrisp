// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { LLMConcurrencyController } from "@/main/core/model-gateway/llm-concurrency-controller";

describe("LLMConcurrencyController", () => {
  it("并发不超过 maxConcurrent", async () => {
    const controller = new LLMConcurrencyController(2);
    let active = 0;
    let maxObserved = 0;

    const task = async () => {
      active++;
      maxObserved = Math.max(maxObserved, active);
      await new Promise((r) => setTimeout(r, 50));
      active--;
    };

    await Promise.all([
      controller.acquire(task),
      controller.acquire(task),
      controller.acquire(task),
      controller.acquire(task),
      controller.acquire(task),
    ]);

    expect(maxObserved).toBeLessThanOrEqual(2);
  });

  it("maxConcurrent=1 时串行执行", async () => {
    const controller = new LLMConcurrencyController(1);
    const order: string[] = [];

    await Promise.all([
      controller.acquire(async () => { order.push("a-start"); await new Promise(r => setTimeout(r, 10)); order.push("a-end"); }),
      controller.acquire(async () => { order.push("b-start"); await new Promise(r => setTimeout(r, 10)); order.push("b-end"); }),
    ]);

    expect(order).toEqual(["a-start", "a-end", "b-start", "b-end"]);
  });

  it("返回原始结果", async () => {
    const controller = new LLMConcurrencyController(3);
    const result = await controller.acquire(async () => 42);
    expect(result).toBe(42);
  });

  it("抛出原始错误", async () => {
    const controller = new LLMConcurrencyController(3);
    await expect(
      controller.acquire(async () => { throw new Error("boom"); }),
    ).rejects.toThrow("boom");
  });

  it("高优先级任务插队", async () => {
    const controller = new LLMConcurrencyController(1);
    const order: string[] = [];

    // 先占住唯一的 slot
    const blocking = controller.acquire(async () => {
      order.push("blocking-start");
      await new Promise((r) => setTimeout(r, 50));
      order.push("blocking-end");
    });

    // 低优先级排队
    const low = controller.acquire(
      async () => { order.push("low"); },
      { priority: "low" },
    );

    // 高优先级排队（应插队到 low 前面）
    const high = controller.acquire(
      async () => { order.push("high"); },
      { priority: "high" },
    );

    await Promise.all([blocking, low, high]);

    expect(order).toEqual(["blocking-start", "blocking-end", "high", "low"]);
  });
});
