// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/main/utils/logger", () => ({
  Logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/main/core/model-gateway/local-gateway/model-registry", () => ({
  EMBEDDING_DIMENSION: 1024,
}));

import { PageVectorDao } from "@/main/core/db/vector.dao";

function makeDao() {
  const table = { delete: vi.fn(async () => {}), add: vi.fn(async () => {}) };
  const db = { openTable: vi.fn(async () => table) };
  const dao = new PageVectorDao(db as never);
  return { dao, table };
}

describe("PageVectorDao.createBatch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("先按 page_id 删除再追加，避免重复行压死 topK 召回", async () => {
    const { dao, table } = makeDao();

    await dao.createBatch([
      { page_id: "p1", project_id: "proj-1", embedding: [0.1] },
      { page_id: "p2", project_id: null, embedding: [0.2] },
    ]);

    expect(table.delete).toHaveBeenCalledWith("page_id IN ('p1', 'p2')");
    expect(table.add).toHaveBeenCalledWith([
      { page_id: "p1", project_id: "proj-1", embedding: [0.1] },
      { page_id: "p2", project_id: null, embedding: [0.2] },
    ]);
    expect(table.delete.mock.invocationCallOrder[0]).toBeLessThan(
      table.add.mock.invocationCallOrder[0],
    );
  });

  it("空数组短路，不触碰 LanceDB", async () => {
    const { dao, table } = makeDao();

    await dao.createBatch([]);

    expect(table.delete).not.toHaveBeenCalled();
    expect(table.add).not.toHaveBeenCalled();
  });
});
