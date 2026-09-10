import { describe, it, expect, vi } from "vitest";

// 只测行↔对象映射，用桩替掉 BaseDao 的数据库访问（工厂内无外部变量，无需 hoist）
vi.mock("@/main/core/db/base.dao", () => ({
  BaseDao: class {
    protected tableName: string;
    constructor(tableName: string) {
      this.tableName = tableName;
    }
  },
}));

import { CreationSessionDao } from "@/main/core/db/creationSession.dao";

describe("CreationSessionDao 行映射", () => {
  it("toEntityForTest 把 snake_case 行映射为对象", () => {
    const dao = new CreationSessionDao();
    const entity = dao.toEntityForTest({
      id: "s1",
      scope: "page",
      project_id: "p1",
      page_id: "pg1",
      stage: "page.write",
      status: "active",
      pending_kind: "section",
      delegation: '{"section":true}',
      created_at: "t0",
      updated_at: "t1",
    });

    expect(entity.projectId).toBe("p1");
    expect(entity.delegation.section).toBe(true);
    expect(entity.pendingKind).toBe("section");
  });

  it("toRowForTest 把对象映射为行，delegation 存 JSON 字符串", () => {
    const dao = new CreationSessionDao();
    const row = dao.toRowForTest({
      id: "s1",
      scope: "work",
      projectId: "p1",
      pageId: null,
      stage: "work.intake",
      status: "active",
      pendingKind: null,
      delegation: {},
      createdAt: "t0",
      updatedAt: "t1",
    });

    expect(row.project_id).toBe("p1");
    expect(row.delegation).toBe("{}");
    expect(row.pending_kind).toBeNull();
  });
});
