import { describe, it, expect } from "vitest";
import { toggleLocalLlmTask } from "@/renderer/utils/local-llm-tasks";

describe("toggleLocalLlmTask", () => {
  it("勾选时加入任务类型", () => {
    expect(toggleLocalLlmTask([], "summary", true)).toEqual(["summary"]);
  });

  it("取消时移除任务类型", () => {
    expect(
      toggleLocalLlmTask(["summary", "topic_summary"], "summary", false),
    ).toEqual(["topic_summary"]);
  });

  it("重复勾选不产生重复项", () => {
    expect(toggleLocalLlmTask(["summary"], "summary", true)).toEqual([
      "summary",
    ]);
  });
});