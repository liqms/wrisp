import { describe, it, expect, vi } from "vitest";

vi.mock("@/main/core/services/material-search.service", () => ({
  materialSearchService: {
    search: vi.fn(async () => [
      { kind: "chunk", id: "c1", content: "素材A" },
    ]),
  },
}));

import { searchMaterialsTool } from "@/main/core/skills/tools/search-materials.tool";
import { materialSearchService } from "@/main/core/services/material-search.service";

describe("search_materials 工具", () => {
  it("缺少 projectId 时返回错误而不抛异常", async () => {
    const raw = await searchMaterialsTool.execute({ query: "设定" });
    expect(JSON.parse(raw).error).toContain("projectId");
  });

  it("按作品检索并返回结果", async () => {
    const raw = await searchMaterialsTool.execute({
      projectId: "p1",
      query: "设定",
      kinds: ["chunk"],
      limit: 3,
    });
    expect(materialSearchService.search).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", query: "设定" }),
    );
    expect(JSON.parse(raw).results[0].id).toBe("c1");
  });
});
