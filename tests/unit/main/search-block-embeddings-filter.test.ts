import { describe, it, expect, vi } from "vitest";
import { searchBlockEmbeddings } from "@/main/core/vector/block-search";

describe("searchBlockEmbeddings 按作品过滤", () => {
  it("传入 projectId 时调用 where 表达式", async () => {
    const where = vi.fn(() => ({
      limit: () => ({ toArray: async () => [] }),
    }));
    const table = { search: vi.fn(() => ({ where })) };

    await searchBlockEmbeddings(table as never, [0, 1], 10, "p1");

    expect(where).toHaveBeenCalledWith("project_id = 'p1'");
  });

  it("未传 projectId 时不加过滤", async () => {
    const search = vi.fn(() => ({
      limit: () => ({ toArray: async () => [] }),
    }));
    const table = { search };

    await searchBlockEmbeddings(table as never, [0, 1], 10);

    expect(search).toHaveBeenCalledTimes(1);
  });
});
