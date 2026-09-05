import { describe, it, expect, vi, beforeAll } from "vitest";
import type { ApiResponse, Character, Tag } from "@/shared/types";

beforeAll(() => {
  // 补充 setup/renderer.ts 未覆盖的 character / tag 模块
  const electronAPI = window.electronAPI as unknown as Record<string, unknown>;
  electronAPI.character = {
    findCharacters: vi.fn().mockImplementation((name: string) =>
      Promise.resolve({
        success: true,
        data: [
          { id: "c1", name: `张${name}` },
          { id: "c2", name: "张三丰" },
        ],
        code: 0,
        timestamp: Date.now(),
      } as ApiResponse<Character[]>),
    ),
  };
  electronAPI.tag = {
    findTags: vi.fn().mockImplementation((name: string) =>
      Promise.resolve({
        success: true,
        data: [{ id: "t1", name: `#${name}` }],
        code: 0,
        timestamp: Date.now(),
      } as ApiResponse<Tag[]>),
    ),
  };
});

describe("loadCharacterItems / loadTagItems", () => {
  it("空 query 不触发 IPC，返回空数组", async () => {
    const { loadCharacterItems, loadTagItems } =
      await import("@/renderer/components/editor/features/inline-semantic/inline-semantic-suggest");
    expect(await loadCharacterItems("")).toEqual([]);
    expect(await loadTagItems("")).toEqual([]);
    expect(window.electronAPI.character.findCharacters).not.toHaveBeenCalled();
    expect(window.electronAPI.tag.findTags).not.toHaveBeenCalled();
  });

  it("非空 query 调 IPC 并映射为 { id, label }", async () => {
    const { loadCharacterItems, loadTagItems } =
      await import("@/renderer/components/editor/features/inline-semantic/inline-semantic-suggest");
    const characters = await loadCharacterItems("三");
    expect(characters).toEqual([
      { id: "c1", label: "张三" },
      { id: "c2", label: "张三丰" },
    ]);
    const tags = await loadTagItems("科幻");
    expect(tags).toEqual([{ id: "t1", label: "#科幻" }]);
  });
});
