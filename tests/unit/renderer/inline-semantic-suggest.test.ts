import { describe, it, expect, vi, beforeAll } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import type { ApiResponse, Character, Tag } from "@/shared/types";
import { createInlineSemanticSuggestExtension } from "@/renderer/components/editor/features/inline-semantic/inline-semantic-suggest";

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

describe("建议下拉点击填入", () => {
  function createEditor(): Editor {
    return new Editor({
      extensions: [StarterKit, createInlineSemanticSuggestExtension()],
      content: "<p></p>",
    });
  }

  it("mousedown 点击 @ 人物项后，纯文本填入编辑器并关闭菜单", async () => {
    const editor = createEditor();
    editor.commands.insertContent("@张");
    // 等待异步 items 加载（IPC mock）与 suggestion 渲染
    await new Promise((r) => setTimeout(r, 100));

    const menu = document.querySelector(".inline-sem-suggest-menu");
    expect(menu).not.toBeNull();
    const items = menu!.querySelectorAll(".inline-sem-suggest-item");
    expect(items.length).toBeGreaterThan(0);

    items[0].dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    await new Promise((r) => setTimeout(r, 50));

    // mock：query="张" → 第一项 label 为 "张张"，替换后应为 "@张张 "
    expect(editor.getText()).toContain("@张张 ");
    expect(document.querySelector(".inline-sem-suggest-menu")).toBeNull();
    editor.destroy();
  });

  it("mousedown 点击 # 标签项后，纯文本填入编辑器", async () => {
    const editor = createEditor();
    editor.commands.insertContent("#科");
    await new Promise((r) => setTimeout(r, 100));

    const menu = document.querySelector(".inline-sem-suggest-menu");
    expect(menu).not.toBeNull();
    const items = menu!.querySelectorAll(".inline-sem-suggest-item");
    expect(items.length).toBeGreaterThan(0);

    items[0].dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
    await new Promise((r) => setTimeout(r, 50));

    // mock：query="科" → 标签 label 为 "#科"
    expect(editor.getText()).toContain("#科 ");
    editor.destroy();
  });
});
