import { describe, it, expect, vi } from "vitest";

// 单测环境无 Electron 运行时（实现会 import Logger）
vi.mock("electron", () => ({
  app: {
    getAppPath: () => process.cwd(),
    getPath: () => process.cwd(),
  },
}));

import { prefetchOutlineMaterials } from "@/main/core/services/outline-material.prefetch";

const node = (id: string, title: string, summary = "") => ({
  id,
  title,
  summary,
  status: "pending" as const,
});

describe("prefetchOutlineMaterials", () => {
  it("为每个节点检索素材，且强制带 projectId", async () => {
    const search = vi.fn(async () => [
      { kind: "chunk" as const, id: "c1", content: "素材" },
    ]);

    const result = await prefetchOutlineMaterials(
      "p1",
      [node("n1", "初到边城", "抵达边城")],
      search,
    );

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1" }),
    );
    expect(result[0].nodeId).toBe("n1");
    expect(result[0].items).toHaveLength(1);
  });

  it("空大纲不触发检索", async () => {
    const search = vi.fn(async () => []);
    const result = await prefetchOutlineMaterials("p1", [], search);
    expect(result).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });

  it("单个节点检索失败不影响其它节点（保守降级为空素材）", async () => {
    const search = vi.fn(async (params: { query: string }) => {
      if (params.query.includes("坏")) throw new Error("boom");
      return [{ kind: "chunk" as const, id: "c1", content: "ok" }];
    });

    const result = await prefetchOutlineMaterials(
      "p1",
      [node("n1", "坏节点"), node("n2", "好节点")],
      search,
    );

    expect(result[0].items).toEqual([]);
    expect(result[1].items).toHaveLength(1);
  });
});
