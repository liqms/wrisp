import { describe, it, expect, vi } from "vitest";

vi.mock("@/main/core/services/chunk.service", () => ({
  chunkService: {
    search: vi.fn(async () => [
      {
        id: "c1",
        content: "本作品的设定 A",
        temporal_score: 1,
        word_count: 4,
        status: "active",
        created_at: "",
        updated_at: "",
      },
    ]),
    getProjectChunkIds: vi.fn(() => []),
  },
}));

import { materialSearchService } from "@/main/core/services/material-search.service";

describe("materialSearchService", () => {
  it("缺少 projectId 时抛错", async () => {
    await expect(
      materialSearchService.search({ projectId: "", query: "设定" }),
    ).rejects.toThrow("PROJECT_ID_REQUIRED");
  });

  it("按作品检索语义块", async () => {
    const items = await materialSearchService.search({
      projectId: "p1",
      query: "设定",
      kinds: ["chunk"],
      limit: 5,
    });
    expect(items).toEqual([
      { kind: "chunk", id: "c1", content: "本作品的设定 A" },
    ]);
  });
});
