// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import {
  resolveLocalFamilies,
  TASK_LLM_TASK_TYPE,
} from "@/main/core/smart-tasks/task-dag";
import { TASK_TYPE } from "@/shared/enums";

describe("resolveLocalFamilies", () => {
  it("全部路由到云端时不含 llm", async () => {
    const route = vi.fn().mockResolvedValue("cloud");
    const families = await resolveLocalFamilies(
      ["chunk-summary", "concept-extract", "topic-summary"],
      route,
    );
    expect(families.has("llm")).toBe(false);
  });

  it("有任务路由到本地时含 llm", async () => {
    const route = vi.fn(async (task: string) =>
      task === TASK_TYPE.SUMMARY ? "local" : "cloud",
    );
    const families = await resolveLocalFamilies(
      ["chunk-summary", "concept-extract"],
      route,
    );
    expect(families.has("llm")).toBe(true);
  });

  it("非 LLM 任务不触发路由调用", async () => {
    const route = vi.fn().mockResolvedValue("local");
    await resolveLocalFamilies(
      ["chunk-vectorize", "semantic-link", "topic-detection"],
      route,
    );
    expect(route).not.toHaveBeenCalled();
  });

  it("路由抛错时不预加载且不抛出", async () => {
    const route = vi.fn().mockRejectedValue(new Error("both unavailable"));
    const families = await resolveLocalFamilies(["chunk-summary"], route);
    expect(families.size).toBe(0);
  });

  it("映射表仅覆盖 3 个 LLM 任务", () => {
    expect(Object.keys(TASK_LLM_TASK_TYPE).sort()).toEqual([
      "chunk-summary",
      "concept-extract",
      "topic-summary",
    ]);
  });
});