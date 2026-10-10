// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
}));
vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import StepManager, { stepManager, taskStepId } from "@/main/core/smart-tasks/step.manager";
import { progressManager } from "@/main/core/smart-tasks/progress.manager";
import { parseEstimatedAmounts } from "@/main/core/smart-tasks/estimate";

const TASKS = ["chunk-vectorize", "semantic-link", "topic-summary"];

describe("StepManager 加权进度", () => {
  let manager: StepManager;

  beforeEach(() => {
    manager = new StepManager();
  });

  it("未开始的步骤按上一轮预估计权，百分比随真实处理量推进", () => {
    manager.beginExecution("exec-1", TASKS, {
      "chunk-vectorize": 1000,
      "semantic-link": 100,
      "topic-summary": 10,
    });

    expect(manager.getWeightedProgress()).toEqual({ done: 0, total: 1110 });
    expect(manager.getSnapshot().overallPercent).toBe(0);

    manager.updateTaskProgress("chunk-vectorize", 500, 1000);
    expect(manager.getWeightedProgress()).toEqual({ done: 500, total: 1110 });
    expect(manager.getSnapshot().overallPercent).toBe(45);
  });

  it("大数据量任务主导进度：小任务跑完不再一步跳到高位", () => {
    manager.beginExecution("exec-1", TASKS, {
      "chunk-vectorize": 1000,
      "semantic-link": 100,
      "topic-summary": 10,
    });
    manager.completeTask({
      taskName: "topic-summary",
      success: true,
      processedCount: 10,
    });

    // 旧口径（已完成步骤数 / 步骤总数）此刻会给出 33%
    expect(manager.getSnapshot().overallPercent).toBe(1);
  });

  it("步骤结束时权重换成本轮实际尝试数，无活可干的步骤不再拖住进度条", () => {
    manager.beginExecution("exec-1", TASKS, {
      "chunk-vectorize": 1000,
      "semantic-link": 1200,
      "topic-summary": 10,
    });
    manager.completeTask({
      taskName: "chunk-vectorize",
      success: true,
      processedCount: 1000,
    });
    expect(manager.getSnapshot().overallPercent).toBe(45);

    // 预估 1200 但本轮增量选取后无事可做：权重收缩为 0，进度条继续走到 100%
    manager.completeTask({
      taskName: "semantic-link",
      success: true,
      processedCount: 0,
    });
    manager.completeTask({
      taskName: "topic-summary",
      success: true,
      processedCount: 10,
    });
    expect(manager.getWeightedProgress()).toEqual({ done: 1010, total: 1010 });
    expect(manager.getSnapshot().overallPercent).toBe(100);
  });

  it("失败条目计入已尝试量，进度不会因失败而回退", () => {
    manager.beginExecution("exec-1", ["semantic-link"], {
      "semantic-link": 100,
    });
    manager.updateTaskProgress("semantic-link", 90, 100);
    expect(manager.getSnapshot().overallPercent).toBe(90);

    manager.completeTask({
      taskName: "semantic-link",
      success: true,
      processedCount: 90,
      failedCount: 10,
    });
    expect(manager.getWeightedProgress()).toEqual({ done: 100, total: 100 });
    expect(manager.getSnapshot().overallPercent).toBe(100);
  });

  it("任务上报真实总量后以真实值为准，预估被替换", () => {
    manager.beginExecution("exec-1", ["semantic-link"], {
      "semantic-link": 100,
    });
    manager.updateTaskProgress("semantic-link", 150, 200);
    expect(manager.getWeightedProgress()).toEqual({ done: 150, total: 200 });
    expect(manager.getSnapshot().overallPercent).toBe(75);
  });

  it("进度单调不减：预估被更小的实际值替换时百分比只升不降", () => {
    manager.beginExecution("exec-1", TASKS, {
      "chunk-vectorize": 1000,
      "semantic-link": 100,
      "topic-summary": 10,
    });
    const seen: number[] = [];
    for (const [name, processed] of [
      ["chunk-vectorize", 1000],
      ["semantic-link", 5],
      ["topic-summary", 0],
    ] as const) {
      manager.completeTask({ taskName: name, success: true, processedCount: processed });
      seen.push(manager.getSnapshot().overallPercent);
    }
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(seen[seen.length - 1]).toBe(100);
  });

  it("无历史预估且本轮无条数时回退按步骤数计算", () => {
    manager.beginExecution("exec-1", TASKS);
    expect(manager.getWeightedProgress()).toEqual({ done: 0, total: 0 });
    expect(manager.getSnapshot().overallPercent).toBe(0);

    manager.setStepState(taskStepId("chunk-vectorize"), "success");
    expect(manager.getSnapshot().overallPercent).toBe(33);
  });

  it("非任务步骤（准备 / 结束 / 模型加载）不参与加权", () => {
    manager.beginExecution("exec-1", ["topic-detection"]);
    manager.insertStepBefore("done", { kind: "model-load", ref: "embedding" });
    manager.completeTask({
      taskName: "topic-detection",
      success: true,
      processedCount: 7,
    });
    expect(manager.getWeightedProgress()).toEqual({ done: 7, total: 7 });
    expect(manager.getSnapshot().overallPercent).toBe(100);
  });

  it("reset 后清空步骤与状态", () => {
    manager.beginExecution("exec-1", TASKS, { "chunk-vectorize": 10 });
    manager.reset();
    expect(manager.getSnapshot()).toMatchObject({
      executionId: null,
      status: "idle",
      overallPercent: 0,
      steps: [],
    });
  });
});

describe("progressManager 与 stepManager 共用一个口径", () => {
  beforeEach(() => {
    stepManager.reset();
    progressManager.reset();
  });

  it("getProgress 返回加权条数而非任务计数", () => {
    stepManager.beginExecution("exec-1", TASKS, {
      "chunk-vectorize": 1000,
      "semantic-link": 100,
      "topic-summary": 10,
    });
    progressManager.registerTasks(TASKS);
    progressManager.update("chunk-vectorize", 250, 1000);

    expect(progressManager.getProgress()).toMatchObject({
      current: 250,
      total: 1110,
      overallPercent: 23,
    });
  });

  it("未注册任务时不产出进度", () => {
    expect(progressManager.getProgress()).toBeNull();
  });
});

describe("parseEstimatedAmounts", () => {
  it("取上一轮 processedCount + failedCount 作为预估", () => {
    expect(
      parseEstimatedAmounts(
        JSON.stringify([
          { name: "chunk-vectorize", processedCount: 90, failedCount: 10 },
          { name: "semantic-link", processedCount: 5 },
        ]),
      ),
    ).toEqual({ "chunk-vectorize": 100, "semantic-link": 5 });
  });

  it("无历史记录返回空对象", () => {
    expect(parseEstimatedAmounts(null)).toEqual({});
    expect(parseEstimatedAmounts(undefined)).toEqual({});
    expect(parseEstimatedAmounts("")).toEqual({});
  });

  it("整轮异常时存的是 { error } 对象，非数组不预估", () => {
    expect(parseEstimatedAmounts(JSON.stringify({ error: "boom" }))).toEqual({});
  });

  it("脏数据不抛错：坏 JSON / 非对象条目 / 缺 name / 非法计数都被忽略", () => {
    expect(parseEstimatedAmounts("{ not json")).toEqual({});
    expect(
      parseEstimatedAmounts(
        JSON.stringify([
          null,
          "junk",
          { processedCount: 3 },
          { name: "semantic-link", processedCount: -1, failedCount: NaN },
          { name: "topic-summary", processedCount: "12" },
          { name: "chunk-summary", processedCount: 4, failedCount: null },
        ]),
      ),
    ).toEqual({ "chunk-summary": 4 });
  });

  it("全零条目不产生预估键，交由回退口径处理", () => {
    expect(
      parseEstimatedAmounts(
        JSON.stringify([{ name: "topic-detection", processedCount: 0 }]),
      ),
    ).toEqual({});
  });
});
