import { describe, it, expect } from "vitest";
import type { CreationSession } from "@/shared/types";

// 类型契约测试：运行时断言恒真，行为回归不会在此失败。不计入行为覆盖。

describe("CreationSession 类型", () => {
  it("可表达页面级会话与待确认步骤", () => {
    const session: CreationSession = {
      id: "s1",
      scope: "page",
      projectId: "p1",
      pageId: "pg1",
      stage: "page.outline_confirm",
      status: "awaiting-confirm",
      pendingKind: "outline",
      delegation: { section: true },
      createdAt: "t0",
      updatedAt: "t1",
    };
    expect(session.pendingKind).toBe("outline");
  });
});
