import { describe, it, expect } from "vitest";
import { toolRegistry } from "@/main/core/skills/tool.registry";

describe("toolRegistry", () => {
  it("不再注册已废弃的 search_blocks 工具", () => {
    expect(toolRegistry.getToolNames()).not.toContain("search_blocks");
  });
});
