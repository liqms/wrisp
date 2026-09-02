import { describe, it, expect, vi, beforeAll } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import SlashMenu from "@/renderer/components/editor/slash/SlashMenu.vue";
import zhCNMessages from "@/shared/i18n/locales/zhCN";
import type { Editor } from "@tiptap/core";

const i18n = createI18n({
  legacy: false,
  locale: "zhCN",
  fallbackLocale: "zhCN",
  messages: { zhCN: zhCNMessages },
  globalInjection: true,
  allowComposition: true,
  missingWarn: false,
  fallbackWarn: false,
});

/** 最小编辑器桩：SlashMenu 仅在定位时使用 view.coordsAtPos */
const editorStub = {
  view: { coordsAtPos: () => ({ left: 10, top: 10, bottom: 30 }) },
} as unknown as Editor;

beforeAll(() => {
  // 补充 setup/renderer.ts 未覆盖的 template 模块
  const electronAPI = window.electronAPI as unknown as Record<
    string,
    Record<string, unknown>
  >;
  electronAPI.template = {
    getFile: vi.fn().mockResolvedValue({
      success: true,
      data: { customTemplates: [], disabledTemplateIds: [] },
      code: 0,
      timestamp: Date.now(),
    }),
    getBuiltIn: vi.fn().mockResolvedValue({
      success: true,
      data: [],
      code: 0,
      timestamp: Date.now(),
    }),
  };
});

describe("SlashMenu 渲染", () => {
  it("visible 时渲染命令组（含基本块）且不崩溃", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => { });
    const wrapper = mount(SlashMenu, {
      props: { visible: true, editor: editorStub, startPos: 1, query: "" },
      global: { plugins: [i18n, createPinia()] },
    });
    await flushPromises();

    // Teleport 渲染到 body，断言需查 document.body
    const html = document.body.innerHTML;
    expect(html).toContain("基本块");
    expect(html).toContain("分割线");

    const renderErrors = consoleError.mock.calls.filter((c) =>
      String(c[0]).includes("TypeError"),
    );
    expect(renderErrors).toEqual([]);
    consoleError.mockRestore();
    wrapper.unmount();
  });
});
