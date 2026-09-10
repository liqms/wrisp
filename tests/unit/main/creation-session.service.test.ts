import { describe, it, expect, vi } from "vitest";

// vi.mock 会被提升：工厂引用的变量必须先用 vi.hoisted 创建
const { store } = vi.hoisted(() => ({
  store: new Map<string, Record<string, unknown>>(),
}));

vi.mock("@/main/core/db", () => ({
  creationSessionDao: {
    insert: (s: { id: string }) => store.set(s.id, { ...s }),
    findSessionById: (id: string) => store.get(id) ?? null,
    updateSession: (s: { id: string }) => store.set(s.id, { ...s }),
    listResumable: () => [...store.values()],
  },
}));

import { creationSessionService } from "@/main/core/services/creation-session.service";

describe("CreationSessionService", () => {
  it("start 创建 active 会话，初始阶段按作用域决定", () => {
    const s = creationSessionService.start("page", "p1", "pg1");
    expect(s.status).toBe("active");
    expect(s.stage).toBe("page.intake");
    expect(s.delegation).toEqual({});
  });

  it("openGate 置为 awaiting-confirm 并记录 pendingKind", () => {
    const s = creationSessionService.start("page", "p2", "pg2");
    const gated = creationSessionService.openGate(s.id, "outline");
    expect(gated.status).toBe("awaiting-confirm");
    expect(gated.pendingKind).toBe("outline");
  });

  it("resolveGate(approve) 清除待确认并回到 active", () => {
    const s = creationSessionService.start("page", "p3", "pg3");
    creationSessionService.openGate(s.id, "outline");
    const resolved = creationSessionService.resolveGate(s.id, "approve");
    expect(resolved.status).toBe("active");
    expect(resolved.pendingKind).toBeNull();
  });

  it("setDelegation 记录逐项委托开关", () => {
    const s = creationSessionService.start("page", "p4", "pg4");
    const updated = creationSessionService.setDelegation(s.id, "section", true);
    expect(updated.delegation.section).toBe(true);
  });

  it("对不存在的会话操作会抛错", () => {
    expect(() => creationSessionService.advance("nope", "page.write")).toThrow(
      "CREATION_SESSION_NOT_FOUND",
    );
  });
});
