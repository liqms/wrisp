import { describe, it, expect } from "vitest";
import type { CreationSession } from "@/shared/types";

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
