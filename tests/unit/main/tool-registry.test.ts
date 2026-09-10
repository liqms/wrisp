import { describe, it, expect } from "vitest";
import { vi } from "vitest";

// 切断注册表 -> 工具 -> 素材服务 的 import 链：
// material-search.service 会拉入 chunk.service 等重依赖（含 Electron app），
// 在无 Electron 运行时的单测环境下会抛 "Cannot read properties of undefined (reading 'getAppPath')"。
vi.mock("@/main/core/services/material-search.service", () => ({
  materialSearchService: { search: vi.fn(async () => []) },
}));

import { toolRegistry } from "@/main/core/skills/tool.registry";

describe("toolRegistry", () => {
  it("不再注册已废弃的 search_blocks 工具", () => {
    expect(toolRegistry.getToolNames()).not.toContain("search_blocks");
  });
});
